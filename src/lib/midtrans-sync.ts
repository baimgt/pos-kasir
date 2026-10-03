import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import StockMovement from '@/models/StockMovement'
import Settings from '@/models/Settings'
import {
  getTransactionStatus,
  isMidtransPaymentSuccessful,
  isMidtransPaymentPending,
  isMidtransPaymentFailed,
} from '@/lib/midtrans'
import { sendReceiptEmail, buildSmtpFromSettings } from '@/lib/email'
import mongoose from 'mongoose'

export interface SyncMidtransResult {
  success: boolean
  message: string
  order?: any
  midtransStatus?: string
  paymentStatus?: string
  alreadyPaid?: boolean
}

/**
 * Deduct stock for items in an order when transitioning to PAID
 */
async function deductOrderStock(
  order: any,
  cashierId?: string,
  cashierName?: string
) {
  try {
    for (const item of order.items) {
      const product = await Product.findById(item.productId)
      if (
        product &&
        product.trackStock !== false &&
        product.productMode !== 'SALES'
      ) {
        const newStock = Math.max(0, product.stock - item.quantity)
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        })
        await StockMovement.create({
          productId: item.productId,
          productName: item.productName,
          type: 'SALE',
          quantity: -item.quantity,
          previousStock: product.stock,
          newStock,
          referenceId: order._id,
          referenceNumber: order.orderNumber,
          userId: cashierId,
          userName: cashierName,
        })
      }
    }
  } catch (stockErr) {
    console.error('Error deducting stock in deductOrderStock:', stockErr)
  }
}

/**
 * Send receipt email for a paid order if customerEmail is set (fire-and-forget)
 */
async function maybeSendReceiptEmail(order: any) {
  if (!order.customerEmail) return
  try {
    const settings = await Settings.findOne().lean() as Record<string, unknown> | null
    if (!settings?.smtpEnabled) return
    await sendReceiptEmail({
      to: order.customerEmail,
      order: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        discountType: order.discountType,
        tax: order.tax,
        taxPercentage: order.taxPercentage,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        cashAmount: order.cashAmount,
        changeAmount: order.changeAmount,
        customerName: order.customerName,
        tableName: order.tableName,
        notes: order.notes,
      },
      store: {
        name: (settings?.storeName as string) || 'POS Kasir',
        address: settings?.storeAddress as string | undefined,
        phone: settings?.storePhone as string | undefined,
        email: settings?.storeEmail as string | undefined,
        receiptFooter: settings?.receiptFooter as string | undefined,
        currencySymbol: (settings?.currencySymbol as string) || 'Rp',
      },
      smtp: buildSmtpFromSettings(settings),
    })
  } catch (err) {
    console.error('[email] Failed to send receipt in midtrans-sync:', err)
  }
}

/**
 * Check transaction status from Midtrans API and sync it with local database
 */
export async function syncMidtransOrderStatus(
  orderIdentifier: string,
  options?: {
    forcedPaid?: boolean
    cashierId?: string
    cashierName?: string
  }
): Promise<SyncMidtransResult> {
  await connectDB()

  // Find order by ID or orderNumber
  const query = mongoose.Types.ObjectId.isValid(orderIdentifier)
    ? { _id: new mongoose.Types.ObjectId(orderIdentifier) }
    : { orderNumber: orderIdentifier }

  const order = await Order.findOne(query)
  if (!order) {
    return { success: false, message: 'Order tidak ditemukan' }
  }

  // If already paid
  if (order.paymentStatus === 'PAID') {
    return {
      success: true,
      message: 'Pesanan sudah berstatus lunas',
      order,
      paymentStatus: 'PAID',
      alreadyPaid: true,
    }
  }

  // If manual forced paid is requested (by Cashier or Admin)
  if (options?.forcedPaid) {
    order.paymentStatus = 'PAID'
    if (order.orderStatus === 'PENDING') {
      order.orderStatus = 'CONFIRMED'
    }
    if (options.cashierId && mongoose.Types.ObjectId.isValid(options.cashierId)) {
      order.cashierId = new mongoose.Types.ObjectId(options.cashierId)
    }
    if (options.cashierName) {
      order.cashierName = options.cashierName
    }
    await order.save()

    // Deduct stock
    await deductOrderStock(order, options.cashierId, options.cashierName)

    // Send receipt email (fire-and-forget)
    maybeSendReceiptEmail(order).catch(() => {})

    return {
      success: true,
      message: 'Status pembayaran berhasil dikonfirmasi lunas secara manual',
      order,
      paymentStatus: 'PAID',
    }
  }

  // Not Midtrans payment
  if (order.paymentMethod !== 'MIDTRANS') {
    return {
      success: false,
      message: 'Pesanan ini tidak menggunakan metode pembayaran Midtrans',
      order,
    }
  }

  // Query Midtrans API directly
  try {
    const notification = await getTransactionStatus(order.orderNumber)
    const txStatus = notification.transaction_status

    if (isMidtransPaymentSuccessful(notification)) {
      order.paymentStatus = 'PAID'
      if (order.orderStatus === 'PENDING') {
        order.orderStatus = 'CONFIRMED'
      }
      order.midtransTransactionId = notification.transaction_id
      order.midtransPaymentType = notification.payment_type
      await order.save()

      // Deduct stock
      await deductOrderStock(order)

      // Send receipt email (fire-and-forget)
      maybeSendReceiptEmail(order).catch(() => {})

      return {
        success: true,
        message: 'Pembayaran berhasil diverifikasi oleh Midtrans (Lunas)',
        order,
        midtransStatus: txStatus,
        paymentStatus: 'PAID',
      }
    } else if (isMidtransPaymentPending(notification)) {
      order.paymentStatus = 'PENDING'
      await order.save()

      return {
        success: true,
        message: 'Menunggu pembayaran dari pelanggan via Midtrans',
        order,
        midtransStatus: txStatus,
        paymentStatus: 'PENDING',
      }
    } else if (isMidtransPaymentFailed(notification)) {
      order.paymentStatus = txStatus === 'expire' ? 'EXPIRED' : 'FAILED'
      order.orderStatus = 'CANCELLED'
      await order.save()

      return {
        success: true,
        message: `Pembayaran Midtrans ${txStatus === 'expire' ? 'telah kadaluarsa (expired)' : 'gagal/dibatalkan'}`,
        order,
        midtransStatus: txStatus,
        paymentStatus: order.paymentStatus,
      }
    }

    return {
      success: true,
      message: `Status Midtrans: ${txStatus}`,
      order,
      midtransStatus: txStatus,
      paymentStatus: order.paymentStatus,
    }
  } catch (err: any) {
    // If Midtrans returns "Transaction doesn't exist" (customer opened snap but hasn't picked a payment method yet)
    if (err.message && err.message.includes("Transaction doesn't exist")) {
      return {
        success: true,
        message: 'Pelanggan belum memilih opsi pembayaran di popup Midtrans',
        order,
        midtransStatus: 'not_selected',
        paymentStatus: order.paymentStatus,
      }
    }

    return {
      success: false,
      message: `Gagal cek Midtrans: ${err.message}`,
      order,
    }
  }
}
