'use client'

import { useEffect, useState, useRef } from 'react'
import { Order } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, RefreshCw, Eye, Printer, Receipt, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { StatusBadge, PaymentMethodBadge, SourceBadge } from '@/components/ui/StatusBadge'
import { ReceiptModal } from '@/components/receipt/ReceiptModal'

export default function CashierTransactionsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const handleSyncMidtrans = async (orderId: string, manual = false) => {
    setSyncingId(orderId)
    try {
      const res = await fetch('/api/payments/midtrans/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, manualConfirm: manual }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'Status berhasil diperbarui')
        fetchOrders()
      } else {
        toast.error(json.message || 'Gagal sinkronisasi Midtrans')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setSyncingId(null)
    }
  }

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.append('search', search)
      if (paymentStatus) params.append('paymentStatus', paymentStatus)
      if (paymentMethod) params.append('paymentMethod', paymentMethod)

      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data)
        setTotalPages(data.pagination?.totalPages || 1)
      } else {
        toast.error('Gagal memuat transaksi')
      }
    } catch {
      toast.error('Terjadi kesalahan memuat transaksi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, paymentStatus, paymentMethod])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Riwayat Transaksi Kasir
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar transaksi kasir Anda dan cetak ulang struk thermal
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nomor order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value)
              setPage(1)
            }}
            aria-label="Filter status bayar"
            className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Semua Status Bayar</option>
            <option value="PAID">Lunas</option>
            <option value="PENDING">Menunggu</option>
            <option value="FAILED">Gagal</option>
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value)
              setPage(1)
            }}
            aria-label="Filter metode bayar"
            className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Semua Metode Bayar</option>
            <option value="CASH">Tunai (Cash)</option>
            <option value="MIDTRANS">Midtrans Digital</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Belum ada riwayat transaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">No. Order</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Status Bayar</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      #{order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={order.source} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentMethodBadge method={order.paymentMethod} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {order.paymentStatus !== 'PAID' && order.paymentMethod === 'MIDTRANS' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 border-blue-200"
                              disabled={syncingId === order._id}
                              onClick={() => handleSyncMidtrans(order._id, false)}
                              title="Cek status terkini langsung ke server Midtrans"
                            >
                              <RefreshCw className={`h-3 w-3 mr-1 ${syncingId === order._id ? 'animate-spin' : ''}`} />
                              Cek Midtrans
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={syncingId === order._id}
                              onClick={() => handleSyncMidtrans(order._id, true)}
                              title="Tandai pembayaran telah diterima/lunas secara manual"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Lunas Manual
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          Cetak Struk
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Thermal Receipt Modal */}
      {selectedOrder && (
        <ReceiptModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}
