import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import StockMovement from '@/models/StockMovement'
import Settings from '@/models/Settings'
import { sendReceiptEmail, buildSmtpFromSettings } from '@/lib/email'
import { withAuth, isAuthError } from '@/lib/api-auth'
import mongoose from 'mongoose'

// GET /api/orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Order ID tidak valid' },
        { status: 400 }
      )
    }

    const order = await Order.findById(id)
      .populate('cashierId', 'name email')
      .populate('tableId', 'name tableNumber')
      .lean()

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cashiers can only see their own orders
    if (
      authResult.user.role === 'CASHIER' &&
      order.cashierId &&
      (order.cashierId as { _id: mongoose.Types.ObjectId })._id?.toString() !== authResult.user.userId &&
      order.cashierId.toString() !== authResult.user.userId
    ) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak' },
        { status: 403 }
      )
    }

    // Kitchen role can only see PAID orders
    if (authResult.user.role === 'KITCHEN' && order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Pesanan belum lunas' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data order' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id] - Update order status (Admin, Cashier, or Kitchen)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()
    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Order ID tidak valid' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { orderStatus, paymentStatus, cashAmount, changeAmount } = body

    // Strict security for KITCHEN role
    if (authResult.user.role === 'KITCHEN') {
      if (paymentStatus || cashAmount !== undefined || changeAmount !== undefined) {
        return NextResponse.json(
          { success: false, message: 'Akses ditolak: Koki tidak diizinkan mengubah status pembayaran' },
          { status: 403 }
        )
      }

      if (orderStatus && !['READY', 'PROCESSING'].includes(orderStatus)) {
        return NextResponse.json(
          { success: false, message: 'Akses ditolak: Koki hanya dapat mengubah status menjadi SIAP (READY)' },
          { status: 403 }
        )
      }
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED']
    const validPaymentStatuses = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']

    if (orderStatus && !validStatuses.includes(orderStatus)) {
      return NextResponse.json(
        { success: false, message: 'Status order tidak valid' },
        { status: 400 }
      )
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return NextResponse.json(
        { success: false, message: 'Status pembayaran tidak valid' },
        { status: 400 }
      )
    }

    const existingOrder = await Order.findById(id)
    if (!existingOrder) {
      return NextResponse.json(
        { success: false, message: 'Order tidak ditemukan' },
        { status: 404 }
      )
    }

    if (authResult.user.role === 'KITCHEN' && existingOrder.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Pesanan belum berstatus LUNAS' },
        { status: 403 }
      )
    }

    const updateFields: Record<string, unknown> = {}
    if (orderStatus) updateFields.orderStatus = orderStatus
    if (paymentStatus) {
      updateFields.paymentStatus = paymentStatus
      if (paymentStatus === 'PAID') {
        updateFields.cashierId = authResult.user.userId
        updateFields.cashierName = authResult.user.name
      }
    }
    if (cashAmount !== undefined) updateFields.cashAmount = cashAmount
    if (changeAmount !== undefined) updateFields.changeAmount = changeAmount

    const wasUnpaid = existingOrder.paymentStatus !== 'PAID'
    const willBePaid = paymentStatus === 'PAID'

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    )
      .populate('cashierId', 'name email')
      .populate('tableId', 'name tableNumber')

    // If transitioning from UNPAID to PAID, deduct stock
    if (wasUnpaid && willBePaid && order) {
      for (const item of order.items) {
        const product = await Product.findById(item.productId)
        if (product && product.trackStock !== false && product.productMode !== 'SALES') {
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
            userId: authResult.user.userId,
            userName: authResult.user.name,
          })
        }
      }

      // Send receipt email if customer provided email
      if (order.customerEmail) {
        try {
          const settings = (await Settings.findOne().lean()) as Record<string, unknown> | null
          if (settings?.smtpEnabled) {
            sendReceiptEmail({
              to: order.customerEmail,
              order: {
                orderNumber: order.orderNumber,
                createdAt: order.createdAt,
                items: order.items.map((it: any) => ({
                  productName: it.productName,
                  quantity: it.quantity,
                  price: it.price,
                  subtotal: it.subtotal,
                })),
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
                tableName: (order.tableId as any)?.name || order.tableName,
                notes: order.notes,
              },
              store: {
                name: (settings.storeName as string) || 'POS Kasir',
                address: settings.storeAddress as string | undefined,
                phone: settings.storePhone as string | undefined,
                email: settings.storeEmail as string | undefined,
                receiptFooter: settings.receiptFooter as string | undefined,
                currencySymbol: (settings.currencySymbol as string) || 'Rp',
              },
              smtp: buildSmtpFromSettings(settings),
            }).catch(() => {})
          }
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Status order berhasil diperbarui',
      data: order,
    })
  } catch (error) {
    console.error('PATCH /api/orders/[id] error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui status order' },
      { status: 500 }
    )
  }
}
