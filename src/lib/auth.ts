import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined')
}

const secret = new TextEncoder().encode(JWT_SECRET)

export interface JWTPayload {
  userId: string
  email: string
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN'
  name: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const expiresIn = JWT_EXPIRES_IN === '7d' ? '7d' : JWT_EXPIRES_IN
  
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getAuthUser(req?: NextRequest): Promise<JWTPayload | null> {
  try {
    let token: string | undefined

    if (req) {
      token = req.cookies.get('auth-token')?.value
    } else {
      const cookieStore = await cookies()
      token = cookieStore.get('auth-token')?.value
    }

    if (!token) return null

    return await verifyToken(token)
  } catch {
    return null
  }
}

export function setAuthCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  
  return `auth-token=${token}; HttpOnly; Secure=${isProduction}; SameSite=Strict; Max-Age=${maxAge}; Path=/`
}

export function clearAuthCookie(): string {
  return 'auth-token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
}
