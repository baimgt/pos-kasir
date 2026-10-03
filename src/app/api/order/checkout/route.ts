import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import Table from '@/models/Table'
import Settings from '@/models/Settings'
import StockMovement from '@/models/StockMovement'
import { generateOrderNumber } from '@/lib/utils'
import { createOrderSchema } from '@/lib/validations'
import mongoose from 'mongoose'

// POST /api/order/checkout - Public QR order checkout
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const parsed = createOrderSchema.safeParse({ ...body, source: 'QR' })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validasi gagal',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Validate table token
    const { tableToken } = body
    if (!tableToken) {
      return NextResponse.json(
        { success: false, message: 'Token meja tidak valid' },
        { status: 400 }
      )
    }

    const table = await Table.findOne({ qrToken: tableToken, isActive: true }).lean()
    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan atau tidak aktif' },
        { status: 404 }
      )
    }

    // Get settings
    const settings = await Settings.findOne().lean()
    if (!settings?.qrOrderingEnabled) {
      return NextResponse.json(
        { success: false, message: 'Pemesanan QR tidak tersedia saat ini' },
        { status: 400 }
      )
    }

    // Validate payment method for QR
    if (data.paymentMethod === 'CASH' && !settings?.qrAllowCashPayment) {
      return NextResponse.json(
        { success: false, message: 'Pembayaran tunai tidak tersedia untuk QR order' },
        { status: 400 }
      )
    }

    if (data.paymentMethod === 'MIDTRANS' && !settings?.qrAllowMidtransPayment) {
      return NextResponse.json(
        { success: false, message: 'Pembayaran Midtrans tidak tersedia untuk QR order' },
        { status: 400 }
      )
    }

    const taxPercentage = settings?.taxEnabled ? (settings?.taxPercentage || 0) : 0

    // Get product prices from DB
    const productIds = data.items.map((item) => item.productId)
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    }).lean()

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, message: 'Beberapa produk tidak tersedia' },
        { status: 400 }
      )
    }

    // Check stock (only for products that track stock)
    for (const item of data.items) {
      const product = products.find((p) => p._id.toString() === item.productId)
      const shouldTrackStock = product && product.trackStock !== false && product.productMode !== 'SALES'
      if (!product || (shouldTrackStock && product.stock < item.quantity)) {
        return NextResponse.json(
          { success: false, message: `Stok ${product?.name || 'produk'} tidak mencukupi` },
          { status: 400 }
        )
      }
    }

    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId)!
      return {
        productId: product._id,
        productName: product.name,
        productImage: product.image,
        quantity: item.quantity,
        price: product.price,
        subtotal: product.price * item.quantity,
      }
    })

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    const taxAmount = Math.round(subtotal * (taxPercentage / 100))
    const total = subtotal + taxAmount

    let orderNumber = generateOrderNumber('QR')
    while (await Order.findOne({ orderNumber })) {
      orderNumber = generateOrderNumber('QR')
    }

    const order = await Order.create({
      orderNumber,
      source: 'QR',
      tableId: table._id,
      tableName: table.name,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      notes: data.notes,
      items: orderItems,
      subtotal,
      discount: 0,
      tax: taxAmount,
      taxPercentage,
      total,
      paymentMethod: data.paymentMethod,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Pesanan berhasil dibuat',
        data: {
          _id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/order/checkout error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat pesanan' },
      { status: 500 }
    )
  }
}
