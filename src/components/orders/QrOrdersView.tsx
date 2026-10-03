'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Order, OrderStatus } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  QrCode, RefreshCw, Clock, CheckCircle2, ChefHat,
  Bell, AlertCircle, Printer, XCircle, DollarSign,
  Utensils, Volume2, VolumeX, Eye, CreditCard
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ReceiptModal } from '@/components/receipt/ReceiptModal'
import { cn } from '@/lib/cn'

export function QrOrdersView({ title = 'Live Monitoring Pesanan QR' }: { title?: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevPendingCount = useRef<number>(0)

  // Modals
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null)
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Payment settle modal (for cash payment from QR order)
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null)
  const [cashAmount, setCashAmount] = useState<string>('')
  const [isSettling, setIsSettling] = useState(false)
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null)

  const handleSyncMidtrans = async (order: Order, manualConfirm = false) => {
    setSyncingOrderId(order._id)
    try {
      const res = await fetch('/api/payments/midtrans/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order._id,
          manualConfirm,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'Status berhasil diperbarui')
        fetchOrders(true)
        if (selectedOrderForDetail?._id === order._id && json.order) {
          setSelectedOrderForDetail(json.order)
        }
      } else {
        toast.error(json.message || 'Gagal sinkronisasi status Midtrans')
      }
    } catch {
      toast.error('Koneksi terputus')
    } finally {
      setSyncingOrderId(null)
    }
  }

  const playChime = useCallback(() => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch {
      // AudioContext might be restricted until user interacts
    }
  }, [soundEnabled])

  const fetchOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true)
    try {
      const res = await fetch('/api/orders?source=QR&limit=50')
      const json = await res.json()
      if (json.success) {
        const fetchedOrders: Order[] = json.data || []
        setOrders(fetchedOrders)

        // Check for new pending orders
        const pendingCount = fetchedOrders.filter((o) => o.orderStatus === 'PENDING').length
        if (pendingCount > prevPendingCount.current && prevPendingCount.current > 0) {
          playChime()
          toast.info('Pesanan QR baru masuk dari meja pelanggan!', {
            icon: '🔔',
          })
        }
        prevPendingCount.current = pendingCount
      }
    } catch {
      if (!isBackground) toast.error('Gagal memuat pesanan QR')
    } finally {
      if (!isBackground) setIsLoading(false)
    }
  }, [playChime])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Polling interval
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchOrders(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchOrders])

  const updateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: nextStatus }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Status pesanan diubah ke: ${nextStatus}`)
        fetchOrders(true)
        if (selectedOrderForDetail?._id === orderId) {
          setSelectedOrderForDetail(json.data)
        }
      } else {
        toast.error(json.message || 'Gagal mengubah status')
      }
    } catch {
      toast.error('Koneksi terputus')
    }
  }

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settlingOrder) return

    const cash = parseFloat(cashAmount.replace(/\D/g, '')) || 0
    if (cash < settlingOrder.total) {
      toast.error(`Nominal uang kurang! Total belanja: ${formatCurrency(settlingOrder.total)}`)
      return
    }

    setIsSettling(true)
    try {
      const change = cash - settlingOrder.total
      const res = await fetch(`/api/orders/${settlingOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          cashAmount: cash,
          changeAmount: change,
          orderStatus: settlingOrder.orderStatus === 'PENDING' ? 'CONFIRMED' : settlingOrder.orderStatus,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Pembayaran diterima! Kembalian: ${formatCurrency(change)}`)
        setSettlingOrder(null)
        setCashAmount('')
        fetchOrders(true)
        // Auto open receipt for print
        setSelectedOrderForReceipt(json.data)
      } else {
        toast.error(json.message || 'Gagal memproses pembayaran')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsSettling(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancellingOrder) return
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/orders/${cancellingOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'CANCELLED' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Pesanan berhasil dibatalkan')
        setCancellingOrder(null)
        fetchOrders(true)
      } else {
        toast.error(json.message || 'Gagal membatalkan pesanan')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setIsCancelling(false)
    }
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (order.tableName && order.tableName.toLowerCase().includes(search.toLowerCase())) ||
      (order.customerName && order.customerName.toLowerCase().includes(search.toLowerCase()))

    let matchesStatus = true
    if (statusFilter === 'ACTIVE') {
      matchesStatus = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY'].includes(order.orderStatus)
    } else if (statusFilter !== 'ALL') {
      matchesStatus = order.orderStatus === statusFilter
    }

    return matchesSearch && matchesStatus
  })

  // Quick stats
  const countPending = orders.filter((o) => o.orderStatus === 'PENDING').length
  const countProcessing = orders.filter((o) => ['CONFIRMED', 'PROCESSING'].includes(o.orderStatus)).length
  const countReady = orders.filter((o) => o.orderStatus === 'READY').length
  const countCompleted = orders.filter((o) => o.orderStatus === 'COMPLETED').length

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <QrCode className="h-7 w-7 text-primary" />
              {title}
            </h1>
            {autoRefresh && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Antrean pesanan langsung dari smartphone pelanggan di meja
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Matikan Suara Notifikasi' : 'Aktifkan Suara Notifikasi'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-primary" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          <Button
            variant={autoRefresh ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            {autoRefresh ? 'Auto Update (ON)' : 'Auto Update (OFF)'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(false)}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={cn(
            'p-4 rounded-xl border transition-all cursor-pointer bg-card',
            statusFilter === 'PENDING' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-border hover:border-amber-400/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Menunggu Konfirmasi</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600">{countPending}</p>
          <span className="text-[11px] text-muted-foreground">Perlu diterima</span>
        </div>

        <div
          onClick={() => setStatusFilter('PROCESSING')}
          className={cn(
            'p-4 rounded-xl border transition-all cursor-pointer bg-card',
            statusFilter === 'PROCESSING' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-border hover:border-indigo-400/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Sedang Diproses</span>
            <ChefHat className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-indigo-600">{countProcessing}</p>
          <span className="text-[11px] text-muted-foreground">Dapur / Bar</span>
        </div>

        <div
          onClick={() => setStatusFilter('READY')}
          className={cn(
            'p-4 rounded-xl border transition-all cursor-pointer bg-card',
            statusFilter === 'READY' ? 'ring-2 ring-cyan-500 border-cyan-500' : 'border-border hover:border-cyan-400/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Siap Saji</span>
            <Utensils className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-cyan-600">{countReady}</p>
          <span className="text-[11px] text-muted-foreground">Siap diantar ke meja</span>
        </div>

        <div
          onClick={() => setStatusFilter('COMPLETED')}
          className={cn(
            'p-4 rounded-xl border transition-all cursor-pointer bg-card',
            statusFilter === 'COMPLETED' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-border hover:border-emerald-400/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Selesai</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">{countCompleted}</p>
          <span className="text-[11px] text-muted-foreground">Tuntas hari ini</span>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
              {[
                { key: 'ACTIVE', label: 'Aktif' },
                { key: 'PENDING', label: 'Menunggu' },
                { key: 'PROCESSING', label: 'Diproses' },
                { key: 'READY', label: 'Siap Saji' },
                { key: 'COMPLETED', label: 'Selesai' },
                { key: 'ALL', label: 'Semua' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                    statusFilter === tab.key
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Cari order, meja, pemesan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid / Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <QrCode className="h-7 w-7" />
            </div>
            <p className="font-semibold text-foreground text-base">Tidak ada pesanan</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search
                ? 'Tidak ditemukan pesanan dengan kriteria pencarian tersebut'
                : 'Saat ini belum ada pesanan baru dari scan QR meja pelanggan.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isPaid = order.paymentStatus === 'PAID'
            const isCashPending = !isPaid && order.paymentMethod === 'CASH'

            return (
              <Card
                key={order._id}
                className={cn(
                  'flex flex-col justify-between overflow-hidden transition-all duration-200 border-border hover:shadow-md',
                  order.orderStatus === 'PENDING' && 'border-amber-400/80 shadow-amber-500/5 bg-amber-500/[0.02]',
                  order.orderStatus === 'READY' && 'border-cyan-400/80 bg-cyan-500/[0.02]'
                )}
              >
                <div>
                  {/* Top Bar */}
                  <div className="p-3.5 bg-muted/30 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow-sm">
                        {order.tableName || 'MEJA'}
                      </span>
                      <div>
                        <span className="text-xs font-mono font-bold text-foreground">
                          #{order.orderNumber}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          order.orderStatus === 'PENDING'
                            ? 'warning'
                            : order.orderStatus === 'PROCESSING' || order.orderStatus === 'CONFIRMED'
                            ? 'info'
                            : order.orderStatus === 'READY'
                            ? 'secondary'
                            : order.orderStatus === 'COMPLETED'
                            ? 'success'
                            : 'destructive'
                        }
                        className="text-[11px]"
                      >
                        {order.orderStatus === 'PENDING'
                          ? 'Menunggu'
                          : order.orderStatus === 'CONFIRMED'
                          ? 'Diterima'
                          : order.orderStatus === 'PROCESSING'
                          ? 'Dimasak'
                          : order.orderStatus === 'READY'
                          ? 'Siap Saji'
                          : order.orderStatus === 'COMPLETED'
                          ? 'Selesai'
                          : 'Batal'}
                      </Badge>

                      <Badge
                        variant={isPaid ? 'success' : 'outline'}
                        className="text-[10px] py-0"
                      >
                        {isPaid
                          ? `Lunas (${order.paymentMethod})`
                          : isCashPending
                          ? 'Bayar di Kasir'
                          : 'Menunggu Midtrans'}
                      </Badge>
                    </div>
                  </div>

                  {/* Customer info */}
                  {order.customerName && (
                    <div className="px-3.5 py-1.5 bg-background border-b border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Pemesan: <strong className="text-foreground">{order.customerName}</strong></span>
                      {order.notes && (
                        <span className="italic text-amber-600 font-medium truncate max-w-[150px]">
                          Note: {order.notes}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Item List */}
                  <div className="p-3.5 space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between text-xs py-1 border-b border-border/30 last:border-none"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                            {item.quantity}x
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{item.productName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              @ {formatCurrency(item.price)}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer and Actions */}
                <div className="p-3.5 border-t border-border bg-muted/15 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Pesanan:</span>
                    <span className="font-bold text-base text-primary">
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  {/* Cash settlement banner if pending cash */}
                  {isCashPending && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                      <span className="text-amber-700 font-medium">Pelanggan bayar tunai</span>
                      <Button
                        size="sm"
                        variant="warning"
                        className="h-7 text-xs px-2.5"
                        onClick={() => {
                          setSettlingOrder(order)
                          setCashAmount(order.total.toString())
                        }}
                      >
                        <DollarSign className="h-3.5 w-3.5 mr-1" />
                        Terima Kas
                      </Button>
                    </div>
                  )}

                  {/* Midtrans digital payment banner if not paid */}
                  {!isPaid && order.paymentMethod === 'MIDTRANS' && (
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" />
                          Midtrans ({order.paymentStatus})
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2 text-blue-600 hover:text-blue-700 border-blue-300"
                          disabled={syncingOrderId === order._id}
                          onClick={() => handleSyncMidtrans(order, false)}
                        >
                          <RefreshCw className={cn("h-3 w-3 mr-1", syncingOrderId === order._id && "animate-spin")} />
                          {syncingOrderId === order._id ? 'Cek...' : 'Cek Status'}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="w-full h-6 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={syncingOrderId === order._id}
                          onClick={() => handleSyncMidtrans(order, true)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Konfirmasi Lunas Manual
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Flow Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {order.orderStatus === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order._id, 'CONFIRMED')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Terima Pesanan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs text-red-500 hover:text-red-600"
                          onClick={() => setCancellingOrder(order)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Tolak
                        </Button>
                      </>
                    )}

                    {order.orderStatus === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        className="col-span-2 w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => updateOrderStatus(order._id, 'PROCESSING')}
                      >
                        <ChefHat className="h-3.5 w-3.5 mr-1.5" />
                        Mulai Masak / Siapkan
                      </Button>
                    )}

                    {order.orderStatus === 'PROCESSING' && (
                      <Button
                        size="sm"
                        className="col-span-2 w-full text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                        onClick={() => updateOrderStatus(order._id, 'READY')}
                      >
                        <Utensils className="h-3.5 w-3.5 mr-1.5" />
                        Makanan Siap Disajikan
                      </Button>
                    )}

                    {order.orderStatus === 'READY' && (
                      <Button
                        size="sm"
                        className="col-span-2 w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateOrderStatus(order._id, 'COMPLETED')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Pesanan Selesai & Diserahkan
                      </Button>
                    )}

                    {order.orderStatus === 'COMPLETED' && (
                      <div className="col-span-2 text-center text-xs text-emerald-600 font-semibold py-1">
                        ✓ Pesanan Selesai
                      </div>
                    )}
                  </div>

                  {/* Print and Details Icons */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                    <button
                      onClick={() => setSelectedOrderForReceipt(order)}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Cetak Tiket / Struk</span>
                    </button>
                    <button
                      onClick={() => setSelectedOrderForDetail(order)}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Detail</span>
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Settle Cash Payment Modal */}
      <Modal
        isOpen={!!settlingOrder}
        onClose={() => setSettlingOrder(null)}
        title={`Terima Pembayaran Tunai - Meja ${settlingOrder?.tableName || ''}`}
        size="sm"
      >
        {settlingOrder && (
          <form onSubmit={handleSettlePayment} className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-mono font-bold text-foreground">#{settlingOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tagihan:</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(settlingOrder.total)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Uang Diterima dari Pelanggan:
              </label>
              <input
                type="number"
                min={settlingOrder.total}
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Masukkan nominal uang tunai..."
                className="w-full text-base font-bold text-foreground p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                autoFocus
              />
            </div>

            {/* Quick cash pills */}
            <div className="grid grid-cols-3 gap-2">
              {[settlingOrder.total, Math.ceil(settlingOrder.total / 10000) * 10000, 50000, 100000].map(
                (amt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCashAmount(amt.toString())}
                    className="text-xs p-1.5 rounded border border-border bg-muted/30 hover:bg-muted text-foreground transition-colors"
                  >
                    {formatCurrency(amt)}
                  </button>
                )
              )}
            </div>

            {/* Change calculation */}
            {parseFloat(cashAmount) >= settlingOrder.total && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
                <span className="text-xs font-semibold text-emerald-800">Kembalian:</span>
                <span className="font-bold text-emerald-700 text-lg">
                  {formatCurrency(parseFloat(cashAmount) - settlingOrder.total)}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setSettlingOrder(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSettling}>
                {isSettling ? 'Menyimpan...' : 'Konfirmasi & Lunas'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedOrderForDetail}
        onClose={() => setSelectedOrderForDetail(null)}
        title={`Rincian Pesanan #${selectedOrderForDetail?.orderNumber || ''}`}
        size="md"
      >
        {selectedOrderForDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
              <div>
                <p className="text-muted-foreground">Meja:</p>
                <p className="font-bold text-sm text-foreground">{selectedOrderForDetail.tableName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Waktu Pemesanan:</p>
                <p className="font-medium text-foreground">{formatDateTime(selectedOrderForDetail.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Nama Pelanggan:</p>
                <p className="font-medium text-foreground">{selectedOrderForDetail.customerName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Metode Pembayaran:</p>
                <p className="font-medium text-foreground">
                  {selectedOrderForDetail.paymentMethod} ({selectedOrderForDetail.paymentStatus})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                Daftar Item Menu
              </h4>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {selectedOrderForDetail.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.quantity}x {item.productName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">@ {formatCurrency(item.price)}</p>
                    </div>
                    <span className="font-bold text-foreground">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-muted/20 rounded-lg space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(selectedOrderForDetail.subtotal)}</span>
              </div>
              {selectedOrderForDetail.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon:</span>
                  <span>-{formatCurrency(selectedOrderForDetail.discount)}</span>
                </div>
              )}
              {selectedOrderForDetail.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pajak (PPN):</span>
                  <span>{formatCurrency(selectedOrderForDetail.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(selectedOrderForDetail.total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                {selectedOrderForDetail.paymentStatus !== 'PAID' && selectedOrderForDetail.paymentMethod === 'MIDTRANS' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingOrderId === selectedOrderForDetail._id}
                      onClick={() => handleSyncMidtrans(selectedOrderForDetail, false)}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncingOrderId === selectedOrderForDetail._id && "animate-spin")} />
                      Cek Status Midtrans
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={syncingOrderId === selectedOrderForDetail._id}
                      onClick={() => handleSyncMidtrans(selectedOrderForDetail, true)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Tandai Lunas Manual
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrderForReceipt(selectedOrderForDetail)
                  }}
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Cetak Struk
                </Button>
                <Button size="sm" onClick={() => setSelectedOrderForDetail(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Order Dialog */}
      <ConfirmDialog
        isOpen={!!cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onConfirm={handleCancelOrder}
        title="Batalkan Pesanan QR"
        message={`Apakah Anda yakin ingin membatalkan pesanan #${cancellingOrder?.orderNumber} dari Meja ${cancellingOrder?.tableName}?`}
        confirmText="Ya, Batalkan"
        cancelText="Kembali"
        variant="danger"
        isLoading={isCancelling}
      />

      {/* Thermal Receipt Print Modal */}
      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}
    </div>
  )
}
