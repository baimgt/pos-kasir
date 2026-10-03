'use client'

import { useEffect, useState } from 'react'
import { Order } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, RefreshCw, Eye, Printer, Filter, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { StatusBadge, PaymentMethodBadge, SourceBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { ReceiptContent } from '@/components/receipt/ReceiptModal'
import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'

export default function TransactionsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [source, setSource] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

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
        if (selectedOrder?._id === orderId && json.order) {
          setSelectedOrder(json.order)
        }
      } else {
        toast.error(json.message || 'Gagal sinkronisasi Midtrans')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setSyncingId(null)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: selectedOrder ? `Struk-${selectedOrder.orderNumber}` : 'Struk',
  })

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.append('search', search)
      if (paymentStatus) params.append('paymentStatus', paymentStatus)
      if (paymentMethod) params.append('paymentMethod', paymentMethod)
      if (source) params.append('source', source)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch {
      toast.error('Gagal memuat transaksi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [page, search, paymentStatus, paymentMethod, source, startDate, endDate])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transaksi</h1>
          <p className="text-muted-foreground text-sm mt-1">Total {total} transaksi</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} size="sm">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari no. transaksi..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Semua Status</option>
          <option value="PAID">Dibayar</option>
          <option value="PENDING">Menunggu</option>
          <option value="FAILED">Gagal</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
        <select
          value={paymentMethod}
          onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Semua Metode</option>
          <option value="CASH">Tunai</option>
          <option value="MIDTRANS">Midtrans</option>
        </select>
        <select
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Semua Sumber</option>
          <option value="POS">POS</option>
          <option value="QR">QR Order</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['No. Transaksi', 'Tanggal', 'Kasir/Customer', 'Total', 'Metode', 'Sumber', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    Tidak ada transaksi ditemukan
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-foreground">{order.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(order.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{order.cashierName || order.customerName || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(order.total)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentMethodBadge method={order.paymentMethod} />
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={order.source} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.paymentStatus} type="payment" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {order.paymentStatus !== 'PAID' && order.paymentMethod === 'MIDTRANS' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 border-blue-200 px-2"
                            disabled={syncingId === order._id}
                            onClick={() => handleSyncMidtrans(order._id, false)}
                            title="Cek status langsung ke Midtrans"
                          >
                            <RefreshCw className={`h-3 w-3 ${syncingId === order._id ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Lihat detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
            <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
          </div>
        )}
      </Card>

      {/* Order Detail Modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Detail Transaksi" size="lg">
        {selectedOrder && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Transaksi</span>
                  <span className="font-mono font-bold">{selectedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{formatDateTime(selectedOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kasir</span>
                  <span>{selectedOrder.cashierName || '-'}</span>
                </div>
                {selectedOrder.tableName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meja</span>
                    <span>{selectedOrder.tableName}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode</span>
                  <PaymentMethodBadge method={selectedOrder.paymentMethod} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sumber</span>
                  <SourceBadge source={selectedOrder.source} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={selectedOrder.paymentStatus} type="payment" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-3">Item Pesanan</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium text-foreground">{item.productName}</span>
                      <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon</span>
                    <span>- {formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak</span>
                    <span>{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-foreground pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(selectedOrder.total)}</span>
                </div>
                {selectedOrder.cashAmount && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Uang Diterima</span>
                      <span>{formatCurrency(selectedOrder.cashAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Kembalian</span>
                      <span>{formatCurrency(selectedOrder.changeAmount || 0)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {selectedOrder.paymentStatus !== 'PAID' && selectedOrder.paymentMethod === 'MIDTRANS' && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Pembayaran Midtrans belum terkonfirmasi
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={syncingId === selectedOrder._id}
                    onClick={() => handleSyncMidtrans(selectedOrder._id, false)}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncingId === selectedOrder._id ? 'animate-spin' : ''}`} />
                    Cek Status Midtrans
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={syncingId === selectedOrder._id}
                    onClick={() => handleSyncMidtrans(selectedOrder._id, true)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Tandai Lunas Manual
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelectedOrder(null)} className="flex-1">Tutup</Button>
              <Button onClick={() => handlePrint()} className="flex-1">
                <Printer className="h-4 w-4" />
                Cetak Struk
              </Button>
            </div>
          </div>
        )}

        {/* Hidden receipt for printing */}
        <div style={{ display: 'none' }}>
          <div ref={receiptRef}>
            {selectedOrder && <ReceiptContent order={selectedOrder} />}
          </div>
        </div>
      </Modal>
    </div>
  )
}
