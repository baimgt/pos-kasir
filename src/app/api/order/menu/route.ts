import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Table from '@/models/Table'
import Settings from '@/models/Settings'
import Product from '@/models/Product'
import Category from '@/models/Category'

// GET /api/order/menu?token=xxx - Public endpoint for QR order page
export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token tidak valid' },
        { status: 400 }
      )
    }

    // Find table by QR token
    const table = await Table.findOne({ qrToken: token, isActive: true }).lean()

    if (!table) {
      return NextResponse.json(
        { success: false, message: 'Meja tidak ditemukan atau tidak aktif' },
        { status: 404 }
      )
    }

    // Get store settings
    const settings = await Settings.findOne().lean()

    // Get active categories
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean()

    // Get active products with categories
    const products = await Product.find({ isActive: true })
      .populate('categoryId', 'name slug')
      .sort({ name: 1 })
      .lean()

    const enrichedProducts = products.map((p) => ({
      ...p,
      trackStock: p.trackStock !== false,
      productMode: p.productMode || (p.trackStock === false ? 'SALES' : 'STOCK'),
    }))

    return NextResponse.json({
      success: true,
      data: {
        table: {
          _id: table._id,
          name: table.name,
          tableNumber: table.tableNumber,
        },
        settings: {
          storeName: settings?.storeName || 'POS Kasir',
          storeAddress: settings?.storeAddress,
          taxEnabled: settings?.taxEnabled || false,
          taxPercentage: settings?.taxPercentage || 0,
          cashPaymentEnabled: settings?.qrAllowCashPayment || false,
          midtransEnabled: settings?.qrAllowMidtransPayment || false,
          currencySymbol: settings?.currencySymbol || 'Rp',
          midtransClientKey: settings?.midtransClientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
          midtransIsProduction: settings?.midtransIsProduction !== undefined
            ? settings.midtransIsProduction
            : process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true',
        },
        categories,
        products: enrichedProducts,
      },
    })
  } catch (error) {
    console.error('GET /api/order/menu error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan' },
      { status: 500 }
    )
  }
}
