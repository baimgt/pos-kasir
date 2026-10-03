import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import { syncMidtransOrderStatus } from '@/lib/midtrans-sync'
import mongoose from 'mongoose'

// GET /api/order/status?orderNumber=xxx or ?orderId=xxx
// Public endpoint for customer to track their QR order status
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const orderNumber = searchParams.get('orderNumber')
    const orderId = searchParams.get('orderId')

    if (!orderNumber && !orderId) {
      return NextResponse.json(
        { success: false, message: 'Nomor atau ID pesanan diperlukan' },
        { status: 400 }
      )
    }

    const query: Record<string, unknown> = {}
    if (orderNumber) {
      query.orderNumber = orderNumber
    } else if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      query._id = new mongoose.Types.ObjectId(orderId)
    }

    const order = await Order.findOne(query)
      .select('orderNumber orderStatus paymentStatus paymentMethod total subtotal tax discount tableName customerName items createdAt')
      .lean()

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Auto-sync with Midtrans API if unpaid Midtrans order
    if (order.paymentMethod === 'MIDTRANS' && order.paymentStatus !== 'PAID') {
      const syncResult = await syncMidtransOrderStatus(order._id.toString())
      const finalOrder = syncResult.order || order
      return NextResponse.json({
        success: true,
        data: {
          ...order,
          paymentStatus: finalOrder.paymentStatus,
          orderStatus: finalOrder.orderStatus,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: order,
    })
  } catch (error) {
    console.error('GET /api/order/status error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil status pesanan' },
      { status: 500 }
    )
  }
}
