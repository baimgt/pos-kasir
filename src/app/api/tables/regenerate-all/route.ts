import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Table from '@/models/Table'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { resolveAppUrl } from '@/lib/utils'
import QRCode from 'qrcode'

// POST /api/tables/regenerate-all - Regenerate QR codes for ALL tables using current domain
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const clientOrigin = (body as Record<string, unknown>)?.origin as string | undefined
    const appUrl = resolveAppUrl(req.headers, clientOrigin)

    const tables = await Table.find({})
    let updatedCount = 0

    for (const table of tables) {
      const qrUrl = `${appUrl}/order/${table.qrToken}`
      const qrCode = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      await Table.findByIdAndUpdate(table._id, { $set: { qrCode } })
      updatedCount++
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memperbarui ${updatedCount} QR Code meja ke domain: ${appUrl}`,
      appUrl,
      updatedCount,
    })
  } catch (error) {
    console.error('POST /api/tables/regenerate-all error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui QR code semua meja' },
      { status: 500 }
    )
  }
}
