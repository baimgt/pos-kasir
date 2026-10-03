import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()

    // Validate input
    const parsed = loginSchema.safeParse(body)
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

    const { email, password } = parsed.data

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Email atau password salah' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.',
        },
        { status: 401 }
      )
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Update last login
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() })

    // Create JWT token
    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    })

    // Set HTTP-only cookie
    const cookieString = setAuthCookie(token)

    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    })

    response.headers.set('Set-Cookie', cookieString)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
