import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Table from '@/models/Table'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { tableSchema } from '@/lib/validations'
import { generateQRToken } from '@/lib/utils'
import QRCode from 'qrcode'
import mongoose from 'mongoose'

// GET /api/tables/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Table ID tidak valid' },
        { status: 400 }
      )
    }

    const table = await Table.findById(id).lean()

    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: table })
  } catch (error) {
    console.error('GET /api/tables/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data meja' },
      { status: 500 }
    )
  }
}

// PUT /api/tables/[id] - Admin only
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
        { success: false, message: 'Table ID tidak valid' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = tableSchema.partial().safeParse(body)

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

    const table = await Table.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    )

    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Meja berhasil diperbarui',
      data: table,
    })
  } catch (error) {
    console.error('PUT /api/tables/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui meja' },
      { status: 500 }
    )
  }
}

// DELETE /api/tables/[id] - Admin only
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
        { success: false, message: 'Table ID tidak valid' },
        { status: 400 }
      )
    }

    const table = await Table.findByIdAndDelete(id)

    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Meja berhasil dihapus',
    })
  } catch (error) {
    console.error('DELETE /api/tables/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus meja' },
      { status: 500 }
    )
  }
}
