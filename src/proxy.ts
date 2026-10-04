import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public paths that don't need authentication
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/order/',
    '/api/payments/midtrans/',
  ]

  // QR order pages are public
  const isQrOrderPath = pathname.startsWith('/order/')

  // API paths that are public
  const isPublicApiPath = publicPaths.some((path) => pathname.startsWith(path))

  // Check if path is public
  if (isPublicApiPath || isQrOrderPath) {
    return NextResponse.next()
  }

  // Check for API routes
  if (pathname.startsWith('/api/')) {
    // Verify the token
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const token = req.cookies.get('auth-token')?.value || bearerToken

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Admin-only API paths
    const adminOnlyPaths = [
      '/api/users',
      '/api/reports',
      '/api/settings',
    ]

    const isAdminOnlyPath = adminOnlyPaths.some((path) => pathname.startsWith(path))

    if (isAdminOnlyPath && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Attach user info to request headers
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', user.userId)
    requestHeaders.set('x-user-role', user.role)
    requestHeaders.set('x-user-name', user.name)
    requestHeaders.set('x-user-email', user.email)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Protected page routes
  const token = req.cookies.get('auth-token')?.value

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const user = await verifyToken(token)

  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('auth-token')
    return response
  }

  // Admin-only page routes
  const adminOnlyPagePaths = [
    '/admin/employees',
    '/admin/settings',
    '/admin/reports',
  ]

  const isAdminOnlyPage = adminOnlyPagePaths.some((path) => pathname.startsWith(path))

  if (isAdminOnlyPage && user.role !== 'ADMIN') {
    const dest = user.role === 'KITCHEN' ? '/kitchen' : '/cashier/dashboard'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // Prevent KITCHEN from accessing cashier or admin pages
  if (user.role === 'KITCHEN' && (pathname.startsWith('/cashier') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/kitchen', req.url))
  }

  // Redirect based on role if accessing root
  if (pathname === '/') {
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url))
    } else if (user.role === 'KITCHEN') {
      return NextResponse.redirect(new URL('/kitchen', req.url))
    } else {
      return NextResponse.redirect(new URL('/cashier/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|uploads).*)',
  ],
}
