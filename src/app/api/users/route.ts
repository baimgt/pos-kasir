import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { createUserSchema } from '@/lib/validations'

// GET /api/users - Admin only
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')

    const query: Record<string, unknown> = {}

    if (role) query.role = role
    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true'
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data karyawan' },
      { status: 500 }
    )
  }
}

// POST /api/users - Admin only
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)

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

    // Check if email already exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email sudah digunakan' },
        { status: 400 }
      )
    }

    const user = await User.create(data)
    const userObj = user.toJSON()

    return NextResponse.json(
      { success: true, message: 'Karyawan berhasil dibuat', data: userObj },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat karyawan' },
      { status: 500 }
    )
  }
}
