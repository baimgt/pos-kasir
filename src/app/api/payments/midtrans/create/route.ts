import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import StockMovement from '@/models/StockMovement'
import {
  createSnapToken,
  getTransactionStatus,
  verifyMidtransSignature,
  isMidtransPaymentSuccessful,
  isMidtransPaymentPending,
  isMidtransPaymentFailed,
  type MidtransNotification,
} from '@/lib/midtrans'
import { withAuth, isAuthError } from '@/lib/api-auth'
import mongoose from 'mongoose'

// POST /api/payments/midtrans/create - Create Midtrans Snap token
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req)
  const isStaff = !isAuthError(authResult)

  try {
    await connectDB()

    const body = await req.json()
    const { orderId } = body

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: 'Order ID tidak valid' },
        { status: 400 }
      )
    }

    const order = await Order.findById(orderId).lean()

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

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { success: false, message: 'Order sudah dibayar' },
        { status: 400 }
      )
    }

    if (order.paymentMethod !== 'MIDTRANS') {
      return NextResponse.json(
        { success: false, message: 'Order tidak menggunakan Midtrans' },
        { status: 400 }
      )
    }

    // Create Midtrans token
    const result = await createSnapToken({
      transactionDetails: {
        orderId: order.orderNumber,
        grossAmount: order.total,
      },
      customerDetails: order.customerName
        ? { firstName: order.customerName }
        : undefined,
      itemDetails: order.items.map((item) => ({
        id: item.productId.toString(),
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        category: 'Product',
      })),
    })

    // Save token to order
    await Order.findByIdAndUpdate(orderId, {
      midtransToken: result.token,
      midtransOrderId: order.orderNumber,
    })

    return NextResponse.json({
      success: true,
      data: {
        token: result.token,
        redirectUrl: result.redirectUrl,
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
      },
    })
  } catch (error) {
    console.error('POST /api/payments/midtrans/create error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat token pembayaran Midtrans' },
      { status: 500 }
    )
  }
}
