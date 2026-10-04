import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { withAuth, isAuthError } from '@/lib/api-auth'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

// POST /api/upload - Upload file gambar dari perangkat
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rawFolder = (formData.get('folder') as string) || 'general'

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'Tidak ada file yang dipilih untuk diunggah' },
        { status: 400 }
      )
    }

    // Validasi tipe MIME
    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format file tidak didukung. Harap unggah file gambar (JPG, PNG, WebP, GIF, SVG).',
        },
        { status: 400 }
      )
    }

    // Validasi ekstensi
    const originalExt = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(originalExt)) {
      return NextResponse.json(
        {
          success: false,
          message: `Ekstensi file ${originalExt} tidak diizinkan. Gunakan JPG, PNG, WebP, GIF, atau SVG.`,
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
          message: `Ukuran file terlalu besar (${sizeMb}MB). Maksimal ukuran file adalah 5MB.`,
        },
        { status: 400 }
      )
    }

    // Sanitasi nama folder
    const folder = rawFolder.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 30) || 'general'

    // Buat nama file unik yang aman
    const rawBaseName = path.basename(file.name, originalExt)
    const sanitizedBase = rawBaseName.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 30) || 'img'
    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const timestamp = Date.now()
    const filename = `${sanitizedBase}-${timestamp}-${randomSuffix}${originalExt}`

    // Siapkan direktori penyimpanan di public/uploads/<folder>
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
    await fs.promises.mkdir(uploadDir, { recursive: true })

    // Tulis buffer file ke disk
    const filePath = path.join(uploadDir, filename)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.promises.writeFile(filePath, buffer)

    // URL path yang bisa diakses dari browser
    const url = `/uploads/${folder}/${filename}`

    return NextResponse.json({
      success: true,
      message: 'File berhasil diunggah',
      data: {
        url,
        filename,
        size: file.size,
        type: file.type,
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
