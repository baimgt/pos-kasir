import { NextRequest, NextResponse } from 'next/server'
import { withAuth, isAuthError } from '@/lib/api-auth'

// Di serverless (Vercel), turunkan limit agar data URL tetap kecil
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
])

/**
 * POST /api/upload
 *
 * Menerima multipart/form-data dengan field:
 *   - file   : File gambar
 *   - folder : (opsional) subfolder kategori, diabaikan di mode data URL
 *
 * Mengembalikan base64 Data URL sehingga tidak perlu filesystem/cloud storage.
 * Kompatibel dengan serverless (Vercel) maupun self-hosted.
 */
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'Tidak ada file yang dipilih untuk diunggah' },
        { status: 400 }
      )
    }

    // Validasi tipe MIME
    const mimeType = file.type.toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format file tidak didukung. Harap unggah file gambar (JPG, PNG, WebP, GIF, SVG).',
        },
        { status: 400 }
      )
    }

    // Validasi ekstensi
    const dotIdx = file.name.lastIndexOf('.')
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          message: `Ekstensi file ${ext} tidak diizinkan. Gunakan JPG, PNG, WebP, GIF, atau SVG.`,
        },
        { status: 400 }
      )
    }

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
      return NextResponse.json(
        {
          success: false,
          message: `Ukuran file terlalu besar (${sizeMb}MB). Maksimal ukuran file adalah 2MB.`,
        },
        { status: 400 }
      )
    }

    // Konversi ke base64 Data URL — tidak butuh filesystem
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    return NextResponse.json({
      success: true,
      message: 'File berhasil diunggah',
      data: {
        url: dataUrl,
        filename: file.name,
        size: file.size,
        type: mimeType,
      },
    })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal mengunggah file. Silakan coba beberapa saat lagi.',
      },
      { status: 500 }
    )
  }
}

