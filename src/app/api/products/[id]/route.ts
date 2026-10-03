import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Product from '@/models/Product'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { productSchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import mongoose from 'mongoose'

// GET /api/products/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Product ID tidak valid' },
        { status: 400 }
      )
    }

    const product = await Product.findById(id)
      .populate('categoryId', 'name slug')
      .lean()

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('GET /api/products/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data produk' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Admin only
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Product ID tidak valid' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = productSchema.partial().safeParse(body)

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

    // Generate new slug if name changed
    if (data.name && !data.slug) {
      let slug = generateSlug(data.name)
      let counter = 0

      while (await Product.findOne({ slug, _id: { $ne: id } })) {
        counter++
        slug = `${generateSlug(data.name)}-${counter}`
      }
      data.slug = slug
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name slug')

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil diperbarui',
      data: product,
    })
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui produk' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Product ID tidak valid' },
        { status: 400 }
      )
    }

    const product = await Product.findByIdAndDelete(id)

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil dihapus',
    })
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus produk' },
      { status: 500 }
    )
  }
}
