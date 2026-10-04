import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import StockMovement from '@/models/StockMovement'
import Settings from '@/models/Settings'
import User from '@/models/User'
import Table from '@/models/Table'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { createOrderSchema } from '@/lib/validations'
import { generateOrderNumber } from '@/lib/utils'
import { runWithTransaction } from '@/lib/transaction'
import { sendReceiptEmail, buildSmtpFromSettings, ReceiptEmailData } from '@/lib/email'
import mongoose from 'mongoose'

// GET /api/orders
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const paymentStatus = searchParams.get('paymentStatus') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const source = searchParams.get('source') || ''
    const cashierId = searchParams.get('cashierId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const search = searchParams.get('search') || ''

    const query: Record<string, unknown> = {}

    // Role-based order scoping
    if (authResult.user.role === 'KITCHEN') {
      // Koki hanya melihat pesanan yang SUDAH DIBAYAR (PAID)
      query.paymentStatus = 'PAID'

      // Koki fokus melihat pesanan yang sedang diproses / antre dimasak
      if (status && ['PROCESSING', 'CONFIRMED', 'READY'].includes(status)) {
        query.orderStatus = status
      } else {
        query.orderStatus = { $in: ['PROCESSING', 'CONFIRMED'] }
      }
    } else {
      if (authResult.user.role === 'CASHIER') {
        if (source === 'QR') {
          query.source = 'QR'
        } else if (source === 'POS') {
          query.cashierId = new mongoose.Types.ObjectId(authResult.user.userId)
          query.source = 'POS'
        } else {
          query.$or = [
            { cashierId: new mongoose.Types.ObjectId(authResult.user.userId) },
            { source: 'QR' },
          ]
        }
      } else {
        if (cashierId && mongoose.Types.ObjectId.isValid(cashierId)) {
          query.cashierId = new mongoose.Types.ObjectId(cashierId)
        }
        if (source) query.source = source
      }

      if (status) query.orderStatus = status
      if (paymentStatus) query.paymentStatus = paymentStatus
      if (paymentMethod) query.paymentMethod = paymentMethod
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ]
    }

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) {
        (query.createdAt as Record<string, Date>).$gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        ;(query.createdAt as Record<string, Date>).$lte = end
      }
    }

    const skip = (page - 1) * limit
    const total = await Order.countDocuments(query)

    const orders = await Order.find(query)
      .populate('cashierId', 'name email')
      .populate('tableId', 'name tableNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data order' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create new order
export async function POST(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const body = await req.json()
    const parsed = createOrderSchema.safeParse(body)

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

    // Get settings for tax
    const settings = await Settings.findOne().lean()
    const taxPercentage = settings?.taxEnabled ? (settings.taxPercentage || 0) : 0

    // Validate and get product prices from DB (NEVER trust client prices)
    const productIds = data.items.map((item) => item.productId)
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    }).lean()

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, message: 'Beberapa produk tidak ditemukan atau tidak aktif' },
        { status: 400 }
      )
    }

    // Check stock availability (only for products in STOCK mode)
    for (const item of data.items) {
      const product = products.find((p) => p._id.toString() === item.productId)
      if (!product) {
        return NextResponse.json(
          { success: false, message: `Produk tidak ditemukan: ${item.productId}` },
          { status: 400 }
        )
      }
      const shouldTrackStock = product.trackStock !== false && product.productMode !== 'SALES'
      if (shouldTrackStock && product.stock < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            message: `Stok ${product.name} tidak mencukupi. Tersedia: ${product.stock}, diminta: ${item.quantity}`,
          },
          { status: 400 }
        )
      }
    }

    // Build order items with server-side prices
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId)!
      return {
        productId: product._id,
        productName: product.name,
        productImage: product.image,
        quantity: item.quantity,
        price: product.price, // Use server-side price
        subtotal: product.price * item.quantity,
      }
    })

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    let discountAmount = 0

    if (data.discount > 0) {
      if (data.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(subtotal * (data.discount / 100))
      } else {
        discountAmount = Math.min(data.discount, subtotal)
      }
    }

    const taxableAmount = subtotal - discountAmount
    const taxAmount = Math.round(taxableAmount * (taxPercentage / 100))
    const total = taxableAmount + taxAmount

    // For cash payment, validate cash amount
    if (data.paymentMethod === 'CASH') {
      if (!data.cashAmount || data.cashAmount < total) {
        return NextResponse.json(
          { success: false, message: 'Jumlah uang tunai tidak mencukupi' },
          { status: 400 }
        )
      }
    }

    // Generate unique order number
    let orderNumber = generateOrderNumber(data.source)
    while (await Order.findOne({ orderNumber })) {
      orderNumber = generateOrderNumber(data.source)
    }

    // Create order data
    const orderData: Record<string, unknown> = {
      orderNumber,
      source: data.source,
      tableId: data.tableId && mongoose.Types.ObjectId.isValid(data.tableId)
        ? new mongoose.Types.ObjectId(data.tableId)
        : undefined,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      notes: data.notes,
      items: orderItems,
      subtotal,
      discount: discountAmount,
      discountType: data.discountType,
      tax: taxAmount,
      taxPercentage,
      total,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentMethod === 'CASH' ? 'PAID' : 'PENDING',
      orderStatus: data.paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING',
      cashierId: authResult.user.userId,
      cashierName: authResult.user.name,
    }

    if (data.paymentMethod === 'CASH') {
      orderData.cashAmount = data.cashAmount
      orderData.changeAmount = (data.cashAmount || 0) - total
    }

    const order = await runWithTransaction(async (session) => {
      const [newOrder] = await Order.create([orderData], session ? { session } : undefined)

      // If cash payment, reduce stock immediately for products that track stock
      if (data.paymentMethod === 'CASH') {
        for (const item of orderItems) {
          const product = products.find((p) => p._id.toString() === item.productId.toString())!
          const shouldTrackStock = product.trackStock !== false && product.productMode !== 'SALES'

          if (shouldTrackStock) {
            const newStock = Math.max(0, product.stock - item.quantity)

            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: -item.quantity } },
              session ? { session } : undefined
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
                  referenceId: newOrder._id,
                  referenceNumber: newOrder.orderNumber,
                  userId: authResult.user.userId,
                  userName: authResult.user.name,
                },
              ],
              session ? { session } : undefined
            )
          }
        }
      }

      return newOrder
    })

    const populated = await Order.findById(order._id)
      .populate('cashierId', 'name email')
      .populate('tableId', 'name tableNumber')
      .lean()

    // Send receipt email for CASH payments if customer provided email
    if (data.paymentMethod === 'CASH' && data.customerEmail && populated && settings?.smtpEnabled) {
      const settingsRec = settings as unknown as Record<string, unknown>
      const pop = populated as unknown as Record<string, unknown>
      sendReceiptEmail({
        to: data.customerEmail,
        order: {
          orderNumber: pop.orderNumber as string,
          createdAt: pop.createdAt as Date,
          items: pop.items as ReceiptEmailData['order']['items'],
          subtotal: pop.subtotal as number,
          discount: pop.discount as number,
          discountType: pop.discountType as string,
          tax: pop.tax as number,
          taxPercentage: pop.taxPercentage as number,
          total: pop.total as number,
          paymentMethod: pop.paymentMethod as string,
          paymentStatus: pop.paymentStatus as string,
          cashAmount: pop.cashAmount as number | undefined,
          changeAmount: pop.changeAmount as number | undefined,
          customerName: data.customerName,
          tableName: pop.tableName as string | undefined,
          notes: data.notes,
        },
        store: {
          name: (settingsRec?.storeName as string) || 'POS Kasir',
          address: settingsRec?.storeAddress as string | undefined,
          phone: settingsRec?.storePhone as string | undefined,
          email: settingsRec?.storeEmail as string | undefined,
          receiptFooter: settingsRec?.receiptFooter as string | undefined,
          currencySymbol: (settingsRec?.currencySymbol as string) || 'Rp',
        },
        smtp: buildSmtpFromSettings(settingsRec),
      }).catch(() => {/* fire-and-forget */})
    }

    return NextResponse.json(
      {
        success: true,
        message: data.paymentMethod === 'CASH'
          ? 'Transaksi berhasil'
          : 'Order berhasil dibuat, lanjutkan pembayaran',
        data: populated,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal membuat order' },
      { status: 500 }
    )
  }
}
