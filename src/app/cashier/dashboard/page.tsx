'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardStats, Order } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import {
  ShoppingCart, QrCode, Receipt, RefreshCw,
  TrendingUp, DollarSign, Clock, ArrowRight, CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, Skeleton } from '@/components/ui/Card'
import { StatusBadge, PaymentMethodBadge } from '@/components/ui/StatusBadge'

export default function CashierDashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashRes, ordersRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/orders?limit=6'),
      ])
      const [dashJson, ordersJson] = await Promise.all([
        dashRes.json(),
        ordersRes.json(),
      ])

      if (dashJson.success) setStats(dashJson.data)
      if (ordersJson.success) setRecentOrders(ordersJson.data || [])
    } catch {
      toast.error('Gagal mengambil data dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-indigo-700 text-primary-foreground p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
            Shift Kasir Aktif
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">
            Selamat Bertugas, {user?.name || 'Kasir'}!
          </h1>
          <p className="text-sm opacity-90 mt-2">
            Akses cepat ke mesin kasir POS, pesanan QR dari meja, dan pantau ringkasan penjualan hari ini.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/cashier/pos"
              className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-4 py-2.5 rounded-xl text-sm shadow hover:bg-zinc-100 transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              Buka Mesin POS (Kasir)
            </Link>
            <Link
              href="/cashier/qr-orders"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              <QrCode className="h-4 w-4" />
              Pesanan QR Masuk
            </Link>
          </div>
        </div>

        {/* Background glow decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Pendapatan Hari Ini</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <p className="text-2xl font-black mt-2 text-foreground">
                {formatCurrency(stats?.todayRevenue || 0)}
              </p>
            )}
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Shift berjalan hari ini
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Total Transaksi Selesai</span>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="text-2xl font-black mt-2 text-foreground">
                {stats?.todayOrders || 0} Struk
              </p>
            )}
            <span className="text-[11px] text-muted-foreground mt-1 block">
              {stats?.cashOrders || 0} Tunai • {stats?.midtransOrders || 0} Digital
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Pesanan Meja (QR Order)</span>
              <QrCode className="h-4 w-4 text-cyan-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="text-2xl font-black mt-2 text-foreground">
                {stats?.qrOrders || 0} Pesanan
              </p>
            )}
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Pelanggan memesan mandiri
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">
                Aktivitas Transaksi Terkini
              </h3>
              <p className="text-xs text-muted-foreground">
                Daftar transaksi pesanan terbaru di restoran
              </p>
            </div>
            <Link
              href="/cashier/transactions"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Lihat Semua
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">
              Belum ada transaksi pada shift ini
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="py-2.5">No. Order</th>
                    <th className="py-2.5">Meja</th>
                    <th className="py-2.5">Waktu</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((ord) => (
                    <tr key={ord._id} className="hover:bg-muted/20">
                      <td className="py-2.5 font-mono font-bold text-foreground">
                        #{ord.orderNumber}
                      </td>
                      <td className="py-2.5 font-medium text-foreground">
                        {ord.tableName || '-'}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {formatDateTime(ord.createdAt).split(' ')[1]}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={ord.paymentStatus} />
                      </td>
                      <td className="py-2.5 text-right font-bold text-foreground">
                        {formatCurrency(ord.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
