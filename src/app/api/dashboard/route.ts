import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import Product from '@/models/Product'
import { withAuth, isAuthError } from '@/lib/api-auth'
import { getDayRange, getMonthRange, calculatePercentageChange } from '@/lib/utils'

// GET /api/dashboard - Dashboard stats
export async function GET(req: NextRequest) {
  const authResult = await withAuth(req)
  if (isAuthError(authResult)) return authResult

  try {
    await connectDB()

    const today = getDayRange()
    const yesterday = getDayRange(new Date(Date.now() - 86400000))
    const thisMonth = getMonthRange()

    // Today's stats
    const todayStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          createdAt: { $gte: today.start, $lte: today.end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          cashOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, 1, 0] } },
          midtransOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'MIDTRANS'] }, 1, 0] } },
          qrOrders: { $sum: { $cond: [{ $eq: ['$source', 'QR'] }, 1, 0] } },
          totalProductsSold: { $sum: { $sum: '$items.quantity' } },
        },
      },
    ])

    // Yesterday's stats for comparison
    const yesterdayStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          createdAt: { $gte: yesterday.start, $lte: yesterday.end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ])

    // Month revenue
    const monthStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          createdAt: { $gte: thisMonth.start, $lte: thisMonth.end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
        },
      },
    ])

    // Last 7 days chart data
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const weeklyData = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, orders: 1, _id: 0 } },
    ])

    // Recent orders
    const recentOrders = await Order.find({})
      .populate('cashierId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    // Low stock products
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minimumStock'] },
    })
      .populate('categoryId', 'name')
      .limit(5)
      .lean()

    const t = todayStats[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      cashOrders: 0,
      midtransOrders: 0,
      qrOrders: 0,
      totalProductsSold: 0,
    }
    const y = yesterdayStats[0] || { totalRevenue: 0, totalOrders: 0 }
    const m = monthStats[0] || { totalRevenue: 0 }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          todayRevenue: t.totalRevenue,
          todayOrders: t.totalOrders,
          monthRevenue: m.totalRevenue,
          totalProductsSold: t.totalProductsSold,
          qrOrders: t.qrOrders,
          cashOrders: t.cashOrders,
          midtransOrders: t.midtransOrders,
          revenueChange: calculatePercentageChange(t.totalRevenue, y.totalRevenue),
          ordersChange: calculatePercentageChange(t.totalOrders, y.totalOrders),
        },
        weeklyData,
        recentOrders,
        lowStockProducts,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data dashboard' },
      { status: 500 }
    )
  }
}
