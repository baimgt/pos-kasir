import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import connectDB from '@/lib/db'
import Settings from '@/models/Settings'
import { withAuth, isAuthError } from '@/lib/api-auth'

// POST /api/settings/email-test - Test SMTP configuration & send test email (Admin only)
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    const body = await req.json().catch(() => ({}))

    await connectDB()
    const dbSettings = await Settings.findOne().lean()

    const host = (body.smtpHost ?? dbSettings?.smtpHost ?? '').trim()
    const port = Number(body.smtpPort ?? dbSettings?.smtpPort ?? 587)
    const secure = body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : Boolean(dbSettings?.smtpSecure)
    const user = (body.smtpUser ?? dbSettings?.smtpUser ?? '').trim()
    const pass = (body.smtpPass ?? dbSettings?.smtpPass ?? '').trim()
    const fromName = (body.smtpFromName ?? dbSettings?.smtpFromName ?? dbSettings?.storeName ?? 'POS Kasir').trim()
    const fromEmail = (body.smtpFromEmail ?? dbSettings?.smtpFromEmail ?? user).trim()
    const testRecipient = (body.testRecipient ?? user).trim()

    if (!host || !user || !pass) {
      return NextResponse.json(
        {
          success: false,
          message: 'Host SMTP, Akun Email, dan Password wajib diisi sebelum melakukan pengujian.',
        },
        { status: 400 }
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 12000,
      greetingTimeout: 10000,
    })

    // 1. Verify connection
    await transporter.verify()

    // 2. Send test email to recipient
    const sendResult = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail || user}>`,
      to: testRecipient,
      subject: `[Uji Coba Berhasil] Konfigurasi Email ${fromName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px 18px; background: #ecfdf5; border-radius: 9999px; color: #059669; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">
              ✓ KONEKSI SMTP BERHASIL
            </div>
          </div>
          <h2 style="color: #111827; font-size: 20px; font-weight: 800; margin: 0 0 12px; text-align: center;">
            Konfigurasi Email Berfungsi Normal!
          </h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 20px; text-align: center;">
            Email ini membuktikan bahwa pengaturan SMTP di web <strong>${fromName}</strong> telah berhasil terhubung dan siap digunakan untuk mengirim struk transaksi digital otomatis kepada pelanggan.
          </p>
          <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 13px; color: #374151;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Host Server:</span>
              <strong>${host}:${port}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Protokol Keamanan:</span>
              <strong>${secure ? 'SSL (Port 465)' : 'TLS / STARTTLS (Port ' + port + ')'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #6b7280;">Pengirim:</span>
              <strong>${fromName} &lt;${fromEmail || user}&gt;</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Waktu Pengujian:</span>
              <strong>${new Date().toLocaleString('id-ID')}</strong>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Sistem POS Kasir Modern • Email otomatis
          </p>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      message: `Koneksi SMTP berhasil! Email uji coba telah dikirim ke ${testRecipient}.`,
      messageId: sendResult.messageId,
    })
  } catch (error: unknown) {
    console.error('Email test error:', error)

    const err = error as Record<string, unknown>
    const code = (err.code as string) || ''
    const msg = (err.message as string) || ''

    let userFriendlyMsg = 'Gagal menghubungi server SMTP: ' + msg

    if (code === 'EAUTH' || msg.toLowerCase().includes('username and password not accepted') || msg.toLowerCase().includes('invalid login')) {
      userFriendlyMsg = 'Autentikasi gagal (username atau password salah). Jika menggunakan Gmail, pastikan Anda menggunakan "App Password" 16 karakter (bukan password akun Google biasa).'
    } else if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || msg.toLowerCase().includes('timeout')) {
      userFriendlyMsg = 'Koneksi ke host SMTP timeout (melebihi batas waktu). Periksa apakah Host dan Port sudah benar, serta pastikan server mengizinkan koneksi keluar.'
    } else if (code === 'ECONNREFUSED') {
      userFriendlyMsg = 'Koneksi ditolak oleh host SMTP. Periksa nomor port atau pastikan host SMTP aktif.'
    } else if (code === 'ENOTFOUND') {
      userFriendlyMsg = 'Host SMTP tidak ditemukan. Pastikan alamat host SMTP sudah benar (misal: smtp.gmail.com).'
    }

    return NextResponse.json(
      {
        success: false,
        message: userFriendlyMsg,
      },
      { status: 400 }
    )
  }
}
