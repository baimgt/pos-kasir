import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Settings from '@/models/Settings'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { settingsSchema } from '@/lib/validations'

// GET /api/settings - All authenticated users
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    let settings = await Settings.findOne().lean()

    if (!settings) {
      // Create default settings
      const created = await Settings.create({
        midtransServerKey: process.env.MIDTRANS_SERVER_KEY || '',
        midtransClientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
        midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      })
      settings = created.toObject()
    }

    if (authResult.user.role !== 'ADMIN') {
      const sanitized = { ...settings }
      delete (sanitized as Record<string, unknown>).midtransServerKey
      return NextResponse.json({ success: true, data: sanitized })
    }

    // Admin view: fallback to env if empty
    const responseData = {
      ...settings,
      midtransServerKey: settings.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '',
      midtransClientKey: settings.midtransClientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
      midtransIsProduction: settings.midtransIsProduction !== undefined
        ? settings.midtransIsProduction
        : process.env.MIDTRANS_IS_PRODUCTION === 'true',
    }

    return NextResponse.json({ success: true, data: responseData })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil pengaturan' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Admin only
export async function PUT(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = settingsSchema.safeParse(body)

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

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { new: true, upsert: true, runValidators: true }
    )

    return NextResponse.json({
      success: true,
      message: 'Pengaturan berhasil disimpan',
      data: settings,
    })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan pengaturan' },
      { status: 500 }
    )
  }
}
