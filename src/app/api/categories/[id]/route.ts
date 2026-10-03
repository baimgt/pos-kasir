import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Category from '@/models/Category'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { categorySchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'
import mongoose from 'mongoose'

// GET /api/categories/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Category ID tidak valid' },
        { status: 400 }
      )
    }

    const category = await Category.findById(id).lean()

    if (!category) {
      return NextResponse.json(
        { success: false, message: 'Kategori tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('GET /api/categories/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data kategori' },
      { status: 500 }
    )
  }
}

// PUT /api/categories/[id] - Admin only
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
        { success: false, message: 'Category ID tidak valid' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = categorySchema.partial().safeParse(body)

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

    if (data.name && !data.slug) {
      let slug = generateSlug(data.name)
      let counter = 0

      while (await Category.findOne({ slug, _id: { $ne: id } })) {
        counter++
        slug = `${generateSlug(data.name)}-${counter}`
      }
      data.slug = slug
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    )

    if (!category) {
      return NextResponse.json(
        { success: false, message: 'Kategori tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil diperbarui',
      data: category,
    })
  } catch (error) {
    console.error('PUT /api/categories/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui kategori' },
      { status: 500 }
    )
  }
}

// DELETE /api/categories/[id] - Admin only
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
        { success: false, message: 'Category ID tidak valid' },
        { status: 400 }
      )
    }

    const category = await Category.findByIdAndDelete(id)

    if (!category) {
      return NextResponse.json(
        { success: false, message: 'Kategori tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Kategori berhasil dihapus',
    })
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus kategori' },
      { status: 500 }
    )
  }
}
