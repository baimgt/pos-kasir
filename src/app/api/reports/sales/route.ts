import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { getDayRange, getMonthRange } from '@/lib/utils'

// GET /api/reports/sales
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req, ['ADMIN'])
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'today'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let dateRange: { start: Date; end: Date }

    if (period === 'today') {
      dateRange = getDayRange()
    } else if (period === 'yesterday') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      dateRange = getDayRange(yesterday)
    } else if (period === '7days') {
      const start = new Date()
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      dateRange = { start, end: new Date() }
    } else if (period === '30days') {
      const start = new Date()
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      dateRange = { start, end: new Date() }
    } else if (period === 'month') {
      dateRange = getMonthRange()
    } else if (period === 'custom' && startDate && endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateRange = { start: new Date(startDate), end }
    } else {
      dateRange = getDayRange()
    }

    const baseQuery = {
      paymentStatus: 'PAID',
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    }

    // Aggregate sales data
    const salesData = await Order.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          cashRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, '$total', 0],
            },
          },
          midtransRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'MIDTRANS'] }, '$total', 0],
            },
          },
          totalCashOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, 1, 0],
            },
          },
          totalMidtransOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'MIDTRANS'] }, 1, 0],
            },
          },
          totalQrOrders: {
            $sum: { $cond: [{ $eq: ['$source', 'QR'] }, 1, 0] },
          },
          totalPosOrders: {
            $sum: { $cond: [{ $eq: ['$source', 'POS'] }, 1, 0] },
          },
        },
      },
    ])

    // Daily sales for chart
    const dailySales = await Order.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          revenue: 1,
          orders: 1,
          _id: 0,
        },
      },
    ])

    // Top products
    const topProducts = await Order.aggregate([
      { $match: baseQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $project: {
          productId: '$_id',
          productName: 1,
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ])

    // Cashier performance
    const cashierReports = await Order.aggregate([
      { $match: { ...baseQuery, cashierId: { $exists: true } } },
      {
        $group: {
          _id: '$cashierId',
          cashierName: { $first: '$cashierName' },
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $project: {
          cashierId: '$_id',
          cashierName: 1,
          totalRevenue: 1,
          totalOrders: 1,
          averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] },
          _id: 0,
        },
      },
    ])

    const summary = salesData[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      cashRevenue: 0,
      midtransRevenue: 0,
      totalCashOrders: 0,
      totalMidtransOrders: 0,
      totalQrOrders: 0,
      totalPosOrders: 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ...summary,
          averageOrderValue:
            summary.totalOrders > 0
              ? summary.totalRevenue / summary.totalOrders
              : 0,
        },
        dailySales,
        chartData: dailySales,
        topProducts,
        cashierReports,
        period,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/reports/sales error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil laporan penjualan' },
      { status: 500 }
    )
  }
}
