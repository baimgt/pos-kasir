import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Settings from '@/models/Settings'
import { withAuth, isAuthError } from '@/lib/api-auth'

// POST /api/settings/midtrans-test - Test Midtrans API credentials (Admin only)
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    const body = await req.json().catch(() => ({}))

    await connectDB()
    const dbSettings = await Settings.findOne().lean()

    const serverKey = (body.serverKey || dbSettings?.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '').trim()
    const isProduction = body.isProduction !== undefined
      ? Boolean(body.isProduction)
      : (dbSettings?.midtransIsProduction ?? (process.env.MIDTRANS_IS_PRODUCTION === 'true'))

    if (!serverKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Server Key Midtrans belum diisi. Masukkan Server Key terlebih dahulu.',
        },
        { status: 400 }
      )
    }

    const credentials = Buffer.from(`${serverKey}:`).toString('base64')

    // Helper to probe Midtrans status endpoint
    const probeMidtrans = async (prod: boolean) => {
      const url = prod
        ? 'https://api.midtrans.com/v2/test-auth-probe-ping/status'
        : 'https://api.sandbox.midtrans.com/v2/test-auth-probe-ping/status'

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
        },
      })
      const status = res.status
      const json = await res.json().catch(() => ({}))
      // 404 or "doesn't exist" means authentication succeeded (key is valid), transaction just doesn't exist
      const isValid = status === 404 || json.status_code === '404' || json.status_message?.toLowerCase().includes("doesn't exist") || status === 200
      const isAuthFailed = status === 401 || json.status_code === '401' || json.status_message?.toLowerCase().includes('access denied')

      return { status, json, isValid, isAuthFailed }
    }

    // 1. First probe the selected environment
    const primary = await probeMidtrans(isProduction)

    if (primary.isValid) {
      return NextResponse.json({
        success: true,
        message: `Koneksi Midtrans Berhasil! Kredensial valid untuk Mode ${isProduction ? 'PRODUCTION (Live)' : 'SANDBOX (Uji Coba)'}.`,
        environment: isProduction ? 'production' : 'sandbox',
      })
    }

    // 2. If primary probe failed with 401, check the alternate environment to help the user
    if (primary.isAuthFailed) {
      try {
        const alternate = await probeMidtrans(!isProduction)
        if (alternate.isValid) {
          const correctEnvName = !isProduction ? 'PRODUCTION (Live)' : 'SANDBOX (Uji Coba)'
          const correctEnvType = !isProduction ? 'production' : 'sandbox'
          return NextResponse.json(
            {
              success: false,
              suggestSwitch: correctEnvType,
              message: `Otorisasi gagal di Mode ${isProduction ? 'Sandbox' : 'Production'}, namun Server Key Anda TERBUKTI VALID di Mode ${correctEnvName}! Silakan klik tombol di bawah untuk beralih ke Mode ${correctEnvName}.`,
            },
            { status: 400 }
          )
        }
      } catch {
        // Ignore secondary probe network errors
      }

      return NextResponse.json(
        {
          success: false,
          message: `Otorisasi gagal: Server Key tidak dikenali di Midtrans ${isProduction ? 'Production' : 'Sandbox'}. Pastikan Server Key disalin lengkap dari Dashboard Midtrans (Settings > Access Keys).`,
        },
        { status: 401 }
      )
    }

    // Any other response
    return NextResponse.json({
      success: true,
      message: `Terhubung ke Midtrans (${isProduction ? 'Production' : 'Sandbox'}). Status respon: ${primary.json?.status_message || primary.status}`,
      environment: isProduction ? 'production' : 'sandbox',
    })
  } catch (error: unknown) {
    console.error('Midtrans test error:', error)
    const errMessage = error instanceof Error ? error.message : 'Koneksi ke Midtrans gagal'
    return NextResponse.json(
      {
        success: false,
        message: `Gagal menghubungi server Midtrans: ${errMessage}. Pastikan koneksi internet aktif.`,
      },
      { status: 500 }
    )
  }
}
