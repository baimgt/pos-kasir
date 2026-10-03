import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Category from '@/models/Category'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { categorySchema } from '@/lib/validations'
import { generateSlug } from '@/lib/utils'

// GET /api/categories
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const query: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true'
    }

    const categories = await Category.find(query)
      .sort({ name: 1 })
      .lean()

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('GET /api/categories error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data kategori' },
      { status: 500 }
    )
  }
}

// POST /api/categories - Admin only
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = categorySchema.safeParse(body)

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

    // Generate unique slug
    let slug = data.slug || generateSlug(data.name)
    let counter = 0

    while (await Category.findOne({ slug })) {
      counter++
      slug = `${generateSlug(data.name)}-${counter}`
    }

    const category = await Category.create({ ...data, slug })

    return NextResponse.json(
      { success: true, message: 'Kategori berhasil dibuat', data: category },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/categories error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat kategori' },
      { status: 500 }
    )
  }
}
