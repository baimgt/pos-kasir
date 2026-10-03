import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import StockMovement from '@/models/StockMovement'
import {
  verifyMidtransSignature,
  isMidtransPaymentSuccessful,
  isMidtransPaymentPending,
  isMidtransPaymentFailed,
  type MidtransNotification,
} from '@/lib/midtrans'
import { runWithTransaction } from '@/lib/transaction'
import mongoose from 'mongoose'

// POST /api/payments/midtrans/webhook - Midtrans notification
// This endpoint must be publicly accessible (no auth)
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const notification: MidtransNotification = await req.json()

    // Verify Midtrans signature for security
    const isValid = await verifyMidtransSignature(notification)

    if (!isValid) {
      console.error('Invalid Midtrans signature:', notification.order_id)
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 400 }
      )
    }

    const { order_id: orderNumber, transaction_status, payment_type } = notification

    // Find order by orderNumber (Midtrans order_id)
    const order = await Order.findOne({ orderNumber }).lean()

    if (!order) {
      console.error('Order not found for Midtrans notification:', orderNumber)
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      )
    }

    // Idempotency check - don't process if already paid
    if (order.paymentStatus === 'PAID') {
      console.log('Order already paid, skipping:', orderNumber)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    await runWithTransaction(async (session) => {
      const sessionOpt = session ? { session } : undefined

      if (isMidtransPaymentSuccessful(notification)) {
        // Payment successful - reduce stock
        const updatedOrder = await Order.findOneAndUpdate(
          { orderNumber, paymentStatus: { $ne: 'PAID' } }, // Prevent double processing
          {
            $set: {
              paymentStatus: 'PAID',
              orderStatus: 'CONFIRMED',
              midtransTransactionId: notification.transaction_id,
              midtransPaymentType: payment_type,
            },
          },
          { new: true, ...sessionOpt }
        )

        if (!updatedOrder) {
          // Already processed by another request
          return
        }

        // Reduce stock for each item
        for (const item of order.items) {
          const product = session 
            ? await Product.findById(item.productId).session(session)
            : await Product.findById(item.productId)

          if (product && product.trackStock !== false && product.productMode !== 'SALES') {
            const newStock = Math.max(0, product.stock - item.quantity)

            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: -item.quantity } },
              sessionOpt
            )

            await StockMovement.create(
              [
                {
                  productId: item.productId,
                  productName: item.productName,
                  type: 'SALE',
                  quantity: -item.quantity,
                  previousStock: product.stock,
                  newStock,
                  referenceId: order._id,
                  referenceNumber: orderNumber,
                },
              ],
              sessionOpt
            )
          }
        }

        console.log('Payment successful for order:', orderNumber)
      } else if (isMidtransPaymentPending(notification)) {
        await Order.findOneAndUpdate(
          { orderNumber },
          { $set: { paymentStatus: 'PENDING' } },
          sessionOpt
        )
        console.log('Payment pending for order:', orderNumber)
      } else if (isMidtransPaymentFailed(notification)) {
        await Order.findOneAndUpdate(
          { orderNumber },
          {
            $set: {
              paymentStatus:
                transaction_status === 'expire' ? 'EXPIRED' : 'FAILED',
              orderStatus: 'CANCELLED',
            },
          },
          sessionOpt
        )
        console.log('Payment failed/expired for order:', orderNumber)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Midtrans webhook error:', error)
    return NextResponse.json(
      { success: false, message: 'Webhook processing error' },
      { status: 500 }
    )
  }
}
