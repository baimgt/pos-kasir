import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Table from '@/models/Table'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { generateQRToken } from '@/lib/utils'
import QRCode from 'qrcode'
import mongoose from 'mongoose'

// POST /api/tables/[id]/qr - Regenerate QR
export async function POST(
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

    const qrToken = generateQRToken()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrUrl = `${appUrl}/order/${qrToken}`

    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    const table = await Table.findByIdAndUpdate(
      id,
      { $set: { qrToken, qrCode } },
      { new: true }
    )

    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'QR Code berhasil dibuat ulang',
      data: table,
    })
  } catch (error) {
    console.error('POST /api/tables/[id]/qr error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat ulang QR Code' },
      { status: 500 }
    )
  }
}
