import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Product from '@/models/Product'
import Category from '@/models/Category'
import Order from '@/models/Order'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { productSchema } from '@/lib/validations'
import { generateSlug, getDayRange, getMonthRange } from '@/lib/utils'
import mongoose from 'mongoose'

// GET /api/products
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const isActive = searchParams.get('isActive')
    const lowStock = searchParams.get('lowStock') === 'true'
    const productMode = searchParams.get('productMode')
    const sortBy = searchParams.get('sortBy') // 'soldToday' | 'soldThisMonth' | 'soldTotal'

    const query: Record<string, unknown> = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ]
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.categoryId = new mongoose.Types.ObjectId(category)
    }

    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true'
    }

    if (productMode && (productMode === 'STOCK' || productMode === 'SALES')) {
      query.productMode = productMode
    }

    if (lowStock) {
      query.$and = [
        { trackStock: { $ne: false } },
        { productMode: { $ne: 'SALES' } },
        { $expr: { $lte: ['$stock', '$minimumStock'] } },
      ]
    }

    const skip = (page - 1) * limit
    const total = await Product.countDocuments(query)

    const products = await Product.find(query)
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Calculate live sales statistics for returned products (sold today, sold this month, total)
    const productIds = products.map((p) => p._id)
    const salesMap = new Map<string, { soldToday: number; soldThisMonth: number; soldTotal: number; revenueThisMonth: number }>()

    if (productIds.length > 0) {
      const today = getDayRange()
      const thisMonth = getMonthRange()

      const stats = await Order.aggregate([
        {
          $match: {
            paymentStatus: 'PAID',
            'items.productId': { $in: productIds },
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.productId': { $in: productIds },
          },
        },
        {
          $group: {
            _id: '$items.productId',
            soldTotal: { $sum: '$items.quantity' },
            soldToday: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$createdAt', today.start] },
                      { $lte: ['$createdAt', today.end] },
                    ],
                  },
                  '$items.quantity',
                  0,
                ],
              },
            },
            soldThisMonth: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$createdAt', thisMonth.start] },
                      { $lte: ['$createdAt', thisMonth.end] },
                    ],
                  },
                  '$items.quantity',
                  0,
                ],
              },
            },
            revenueThisMonth: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$createdAt', thisMonth.start] },
                      { $lte: ['$createdAt', thisMonth.end] },
                    ],
                  },
                  '$items.subtotal',
                  0,
                ],
              },
            },
          },
        },
      ])

      for (const s of stats) {
        salesMap.set(s._id.toString(), {
          soldToday: s.soldToday || 0,
          soldThisMonth: s.soldThisMonth || 0,
          soldTotal: s.soldTotal || 0,
          revenueThisMonth: s.revenueThisMonth || 0,
        })
      }
    }

    let enrichedProducts = products.map((p) => {
      const s = salesMap.get(p._id.toString()) || {
        soldToday: 0,
        soldThisMonth: 0,
        soldTotal: 0,
        revenueThisMonth: 0,
      }
      return {
        ...p,
        trackStock: p.trackStock !== false,
        productMode: p.productMode || (p.trackStock === false ? 'SALES' : 'STOCK'),
        soldToday: s.soldToday,
        soldThisMonth: s.soldThisMonth,
        soldTotal: s.soldTotal,
        revenueThisMonth: s.revenueThisMonth,
      }
    })

    if (sortBy === 'soldToday') {
      enrichedProducts.sort((a, b) => (b.soldToday || 0) - (a.soldToday || 0))
    } else if (sortBy === 'soldThisMonth') {
      enrichedProducts.sort((a, b) => (b.soldThisMonth || 0) - (a.soldThisMonth || 0))
    } else if (sortBy === 'soldTotal') {
      enrichedProducts.sort((a, b) => (b.soldTotal || 0) - (a.soldTotal || 0))
    }

    return NextResponse.json({
      success: true,
      data: enrichedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data produk' },
      { status: 500 }
    )
  }
}

// POST /api/products - Admin only
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = productSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validasi gagal',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate categoryId
    if (!mongoose.Types.ObjectId.isValid(data.categoryId)) {
      return NextResponse.json(
        { success: false, message: 'Category ID tidak valid' },
        { status: 400 }
      )
    }

    const categoryExists = await Category.findById(data.categoryId)
    if (!categoryExists) {
      return NextResponse.json(
        { success: false, message: 'Kategori tidak ditemukan' },
        { status: 400 }
      )
    }

    // Generate unique slug
    let slug = data.slug || generateSlug(data.name)
    let counter = 0

    while (await Product.findOne({ slug })) {
      counter++
      slug = `${generateSlug(data.name)}-${counter}`
    }

    const product = await Product.create({
      ...data,
      slug,
      categoryId: new mongoose.Types.ObjectId(data.categoryId),
    })

    const populated = await product.populate('categoryId', 'name slug')

    return NextResponse.json(
      { success: true, message: 'Produk berhasil dibuat', data: populated },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/products error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat produk' },
      { status: 500 }
    )
  }
}
