import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from './auth'

export async function withAuth(
  req: NextRequest,
  allowedRoles?: ('ADMIN' | 'CASHIER' | 'KITCHEN')[]
): Promise<{ user: JWTPayload } | NextResponse> {
  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
  const token = req.cookies.get('auth-token')?.value || bearerToken

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized: No token provided' },
      { status: 401 }
    )
  }

  const user = await verifyToken(token)

  if (!user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized: Invalid or expired token' },
      { status: 401 }
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Forbidden: You do not have permission to access this resource',
      },
      { status: 403 }
    )
  }

  return { user }
}

export function isAuthError(
  result: { user: JWTPayload } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
