'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Package,
  QrCode,
  Banknote,
  CreditCard,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/Card'
import { StatusBadge, PaymentMethodBadge, SourceBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

interface DashboardData {
  stats: {
    todayRevenue: number
    todayOrders: number
    monthRevenue: number
    totalProductsSold: number
    qrOrders: number
    cashOrders: number
    midtransOrders: number
    revenueChange: number
    ordersChange: number
  }
  weeklyData: { date: string; revenue: number; orders: number }[]
  recentOrders: {
    _id: string
    orderNumber: string
    cashierName?: string
    total: number
    paymentMethod: string
    paymentStatus: string
    orderStatus: string
    source: string
    createdAt: string
  }[]
  lowStockProducts: {
    _id: string
    name: string
    stock: number
    minimumStock: number
  }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  color = 'blue',
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  change?: number
  color?: string
}) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  }

  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
            {typeof change !== 'undefined' && (
              <div className="flex items-center gap-1 mt-2">
                {change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                >
                  {change >= 0 ? '+' : ''}{change}% vs kemarin
                </span>
              </div>
            )}
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorMap[color as keyof typeof colorMap] || colorMap.blue}`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Gagal memuat data dashboard')
      }
    } catch {
      toast.error('Terjadi kesalahan saat memuat dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboard, 60000)
    return () => clearInterval(interval)
  }, [])

  const paymentDistribution = data
    ? [
        { name: 'Tunai', value: data.stats.cashOrders, color: '#10b981' },
        { name: 'Midtrans', value: data.stats.midtransOrders, color: '#3b82f6' },
      ]
    : []

  const sourceDistribution = data
    ? [
        { name: 'POS', value: data.stats.todayOrders - data.stats.qrOrders, color: '#8b5cf6' },
        { name: 'QR', value: data.stats.qrOrders, color: '#f59e0b' },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Selamat datang! Berikut ringkasan hari ini.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDashboard}
          isLoading={isLoading}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Penjualan Hari Ini"
            value={formatCurrency(data?.stats.todayRevenue || 0)}
            icon={DollarSign}
            change={data?.stats.revenueChange}
            color="blue"
          />
          <StatCard
            title="Transaksi Hari Ini"
            value={String(data?.stats.todayOrders || 0)}
            icon={ShoppingCart}
            change={data?.stats.ordersChange}
            color="green"
          />
          <StatCard
            title="Pendapatan Bulan Ini"
            value={formatCurrency(data?.stats.monthRevenue || 0)}
            icon={TrendingUp}
            color="purple"
          />
          <StatCard
            title="Produk Terjual"
            value={String(data?.stats.totalProductsSold || 0)}
            subtitle="Hari ini"
            icon={Package}
            color="orange"
          />
          <StatCard
            title="Pesanan QR"
            value={String(data?.stats.qrOrders || 0)}
            subtitle="Hari ini"
            icon={QrCode}
            color="pink"
          />
          <StatCard
            title="Transaksi Tunai"
            value={String(data?.stats.cashOrders || 0)}
            subtitle="Hari ini"
            icon={Banknote}
            color="green"
          />
          <StatCard
            title="Transaksi Midtrans"
            value={String(data?.stats.midtransOrders || 0)}
            subtitle="Hari ini"
            icon={CreditCard}
            color="blue"
          />
          <StatCard
            title="Stok Rendah"
            value={String(data?.lowStockProducts.length || 0)}
            subtitle="Produk"
            icon={AlertTriangle}
            color="orange"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Weekly Revenue Chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Penjualan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={264}>
                <AreaChart data={data?.weeklyData || []}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => {
                      const d = new Date(v)
                      return `${d.getDate()}/${d.getMonth() + 1}`
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatCurrency(Number(value) || 0), 'Penjualan']}
                    labelFormatter={(label) => {
                      const d = new Date(String(label))
                      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Metode Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={264}>
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-sm text-foreground">{value}</span>
                    )}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [Number(value) || 0, 'Transaksi']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transaksi Terbaru</CardTitle>
            <a href="/admin/transactions" className="text-xs text-primary hover:underline">
              Lihat semua
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.recentOrders.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Belum ada transaksi
                  </div>
                ) : (
                  data?.recentOrders.slice(0, 8).map((order) => (
                    <div key={order._id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {order.orderNumber}
                          </span>
                          <SourceBadge source={order.source} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.cashierName || 'Customer'} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(order.total)}
                        </p>
                        <StatusBadge status={order.paymentStatus} type="payment" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Warning */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Stok Rendah
            </CardTitle>
            <a href="/admin/stock" className="text-xs text-primary hover:underline">
              Kelola stok
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.lowStockProducts.length === 0 ? (
                  <div className="p-8 text-center">
                    <Package className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Semua stok aman ✓</p>
                  </div>
                ) : (
                  data?.lowStockProducts.map((product) => (
                    <div key={product._id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Min: {product.minimumStock} unit
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${product.stock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                          {product.stock}
                        </span>
                        <p className="text-xs text-muted-foreground">tersisa</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
