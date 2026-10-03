import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import { syncMidtransOrderStatus } from '@/lib/midtrans-sync'
import { withAuth, isAuthError } from '@/lib/api-auth'
import mongoose from 'mongoose'

// POST /api/payments/midtrans/sync
// Body: { orderId?: string, orderNumber?: string, manualConfirm?: boolean }
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { orderId, orderNumber, manualConfirm } = body

    if (!orderId && !orderNumber) {
      return NextResponse.json(
        { success: false, message: 'Order ID atau nomor pesanan diperlukan' },
        { status: 400 }
      )
    }

    const identifier = orderId || orderNumber

    // If manual confirmation is requested, require auth (admin or cashier)
    if (manualConfirm) {
      const authResult = await withAuth(req)
      if (isAuthError(authResult)) {
        return authResult
      }

      const result = await syncMidtransOrderStatus(identifier, {
        forcedPaid: true,
        cashierId: authResult.user.userId,
        cashierName: authResult.user.name,
      })

      return NextResponse.json(result)
    }

    // Normal sync by calling Midtrans API
    const result = await syncMidtransOrderStatus(identifier)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('POST /api/payments/midtrans/sync error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal sinkronisasi status Midtrans' },
      { status: 500 }
    )
  }
}
