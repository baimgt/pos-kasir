import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Table from '@/models/Table'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { tableSchema } from '@/lib/validations'
import { generateQRToken, resolveAppUrl } from '@/lib/utils'
import QRCode from 'qrcode'

// GET /api/tables
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const query: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true'
    }

    const tables = await Table.find(query).sort({ tableNumber: 1 }).lean()

    return NextResponse.json({ success: true, data: tables })
  } catch (error) {
    console.error('GET /api/tables error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data meja' },
      { status: 500 }
    )
  }
}

// POST /api/tables - Admin only
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = tableSchema.safeParse(body)

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

    // Check if table number already exists
    const existingTable = await Table.findOne({ tableNumber: data.tableNumber })
    if (existingTable) {
      return NextResponse.json(
        { success: false, message: 'Nomor meja sudah digunakan' },
        { status: 400 }
      )
    }

    const qrToken = generateQRToken()
    const clientOrigin = (body as Record<string, unknown>)?.origin as string | undefined
    const appUrl = resolveAppUrl(req.headers, clientOrigin)
    const qrUrl = `${appUrl}/order/${qrToken}`

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    const table = await Table.create({
      ...data,
      qrToken,
      qrCode,
    })

    return NextResponse.json(
      { success: true, message: 'Meja berhasil dibuat', data: table },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/tables error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat meja' },
      { status: 500 }
    )
  }
}
