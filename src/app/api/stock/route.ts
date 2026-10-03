import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Product from '@/models/Product'
import StockMovement, { StockMovementType } from '@/models/StockMovement'
import { withAuth, isAuthError } from '@/lib/api-auth'
import mongoose from 'mongoose'

// GET /api/stock - List stock movements & low stock products
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN', 'CASHIER'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const type = searchParams.get('type')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20'))
    const skip = (page - 1) * limit

    const query: Record<string, unknown> = {}
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.productId = new mongoose.Types.ObjectId(productId)
    }
    if (type && ['SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN'].includes(type)) {
      query.type = type
    }

    const [movements, total, lowStockProducts] = await Promise.all([
      StockMovement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name sku price stock')
        .populate('userId', 'name')
        .lean(),
      StockMovement.countDocuments(query),
      Product.find({
        $expr: { $lte: ['$stock', '$minimumStock'] },
        isActive: true,
      })
        .select('name sku stock minimumStock price categoryId')
        .populate('categoryId', 'name')
        .sort({ stock: 1 })
        .lean(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        movements,
        lowStockProducts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/stock error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data riwayat stok' },
      { status: 500 }
    )
  }
}

// POST /api/stock - Stock adjustment or restock (Admin only)
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const { productId, type, quantity, notes } = body

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json(
        { success: false, message: 'Product ID tidak valid' },
        { status: 400 }
      )
    }

    const validTypes: StockMovementType[] = ['RESTOCK', 'ADJUSTMENT', 'RETURN']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Tipe penyesuaian stok tidak valid' },
        { status: 400 }
      )
    }

    const qty = Number(quantity)
    if (isNaN(qty) || qty === 0) {
      return NextResponse.json(
        { success: false, message: 'Jumlah perubahan stok harus berupa angka bukan nol' },
        { status: 400 }
      )
    }

    const product = await Product.findById(productId)
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    const previousStock = product.stock
    const newStock = previousStock + qty

    if (newStock < 0) {
      return NextResponse.json(
        { success: false, message: `Stok tidak boleh bernilai negatif (sisa saat ini: ${previousStock})` },
        { status: 400 }
      )
    }

    // Update product stock
    product.stock = newStock
    await product.save()

    // Create stock movement record
    const movement = await StockMovement.create({
      productId: product._id,
      productName: product.name,
      type,
      quantity: qty,
      previousStock,
      newStock,
      notes: notes || '',
      userId: authResult.user.userId,
      userName: authResult.user.name,
    })

    return NextResponse.json({
      success: true,
      message: 'Stok berhasil diperbarui',
      data: {
        product,
        movement,
      },
    })
  } catch (error) {
    console.error('POST /api/stock error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui stok' },
      { status: 500 }
    )
  }
}
