import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import { syncMidtransOrderStatus } from '@/lib/midtrans-sync'
import { withAuth, isAuthError } from '@/lib/api-auth'
import mongoose from 'mongoose'

// GET /api/payments/midtrans/status?orderId=xxx or ?orderNumber=xxx
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req)
  const isStaff = !isAuthError(authResult)

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const orderNumber = searchParams.get('orderNumber')

    if (!orderId && !orderNumber) {
      return NextResponse.json(
        { success: false, message: 'Order ID atau nomor pesanan wajib diisi' },
        { status: 400 }
      )
    }

    const query: Record<string, unknown> = {}
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      query._id = new mongoose.Types.ObjectId(orderId)
    } else if (orderNumber) {
      query.orderNumber = orderNumber
    } else {
      query._id = orderId
    }

    const order = await Order.findOne(query).lean()

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order tidak ditemukan' },
        { status: 404 }
      )
    }

    // Require authentication only for POS orders
    if (!isStaff && order.source !== 'QR') {
      return authResult as NextResponse
    }

    // If order uses Midtrans and is not PAID, automatically query Midtrans API to sync
    if (order.paymentMethod === 'MIDTRANS' && order.paymentStatus !== 'PAID') {
      const syncResult = await syncMidtransOrderStatus(order._id.toString())
      const updatedOrder = syncResult.order || order

      return NextResponse.json({
        success: true,
        data: {
          orderId: updatedOrder._id,
          orderNumber: updatedOrder.orderNumber,
          paymentStatus: updatedOrder.paymentStatus,
          orderStatus: updatedOrder.orderStatus,
          total: updatedOrder.total,
          midtransTransactionId: updatedOrder.midtransTransactionId,
          midtransPaymentType: updatedOrder.midtransPaymentType,
          syncMessage: syncResult.message,
        },
      })
    }

    // Return current status from DB
    return NextResponse.json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        total: order.total,
        midtransTransactionId: order.midtransTransactionId,
        midtransPaymentType: order.midtransPaymentType,
      },
    })
  } catch (error) {
    console.error('GET /api/payments/midtrans/status error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memeriksa status pembayaran' },
      { status: 500 }
    )
  }
}

