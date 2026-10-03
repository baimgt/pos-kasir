import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { updateUserSchema } from '@/lib/validations'
import mongoose from 'mongoose'

// GET /api/users/[id] - Admin only
export async function GET(
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
        { success: false, message: 'User ID tidak valid' },
        { status: 400 }
      )
    }

    const user = await User.findById(id).select('-password').lean()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Karyawan tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('GET /api/users/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data karyawan' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] - Admin only
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
        { success: false, message: 'User ID tidak valid' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)

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

    // Check email uniqueness if changing
    if (data.email) {
      const existingUser = await User.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: id },
      })
      if (existingUser) {
        return NextResponse.json(
          { success: false, message: 'Email sudah digunakan' },
          { status: 400 }
        )
      }
    }

    // If password is provided, hash it manually and include it in the update
    let hashedPassword: string | undefined
    if (data.password && data.password.trim()) {
      const bcrypt = await import('bcryptjs')
      const salt = await bcrypt.genSalt(12)
      hashedPassword = await bcrypt.hash(data.password.trim(), salt)
    }

    const updateData: Record<string, unknown> = { ...data }
    delete updateData.password

    if (hashedPassword) {
      updateData.password = hashedPassword
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Karyawan tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Karyawan berhasil diperbarui',
      data: user,
    })
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui karyawan' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    // Prevent deleting yourself
    if (id === authResult.user.userId) {
      return NextResponse.json(
        { success: false, message: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      )
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'User ID tidak valid' },
        { status: 400 }
      )
    }

    const user = await User.findByIdAndDelete(id)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Karyawan tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Karyawan berhasil dihapus',
    })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus karyawan' },
      { status: 500 }
    )
  }
}
