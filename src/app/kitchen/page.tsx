'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Order, OrderStatus } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChefHat, RefreshCw, Clock, CheckCircle2,
  Utensils, Volume2, VolumeX, AlertCircle,
  Search, Flame, Coffee, Sparkles, Filter, Check, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

// Audio chime using Web Audio API
function playChime(type: 'new-order' | 'order-ready' = 'new-order') {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    if (type === 'new-order') {
      // Pleasant double bell (880Hz -> 1174Hz)
      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.5)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1174.66, now + 0.18)
      gain2.gain.setValueAtTime(0.3, now + 0.18)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.18)
      osc2.stop(now + 0.8)
    } else {
      // Success bell
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, now)
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.2)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    }
  } catch {
    // Audio context may be restricted by browser policy before first interaction
  }
}

// Elapsed time helper
function formatElapsed(createdAt: string, now: number) {
  const diffSec = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  if (minutes < 1) return `${seconds} dtk lalu`
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  return `${hours} jam ${minutes % 60} mnt lalu`
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'PROCESSING_ONLY' | 'ALL_ACTIVE' | 'READY_RECENT'>('ALL_ACTIVE')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  const prevOrderCountRef = useRef<number>(0)
  const isFirstLoadRef = useRef<boolean>(true)

  // Live timer tick every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Fetch orders from API
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      // Koki hanya mengambil pesanan yang sudah dibayar (paymentStatus=PAID)
      const res = await fetch('/api/orders?limit=100&paymentStatus=PAID')
      const json = await res.json()

      if (json.success) {
        const fetched: Order[] = json.data || []
        setOrders(fetched)

        // Count pending active orders
        const activeCount = fetched.filter((o) =>
          ['CONFIRMED', 'PROCESSING'].includes(o.orderStatus)
        ).length

        // Notify sound if new orders arrived
        if (!isFirstLoadRef.current && soundEnabled && activeCount > prevOrderCountRef.current) {
          playChime('new-order')
          toast.info('Pesanan baru masuk ke antrean dapur!', {
            icon: '🔔',
          })
        }
        prevOrderCountRef.current = activeCount
        isFirstLoadRef.current = false
      } else {
        if (!silent) toast.error('Gagal mengambil data pesanan dapur')
      }
    } catch {
      if (!silent) toast.error('Gagal menghubungi server')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [soundEnabled])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Polling every 8 seconds if autoRefresh is active
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchOrders(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchOrders])

  // Mark order as READY
  const handleMarkAsReady = async (orderId: string, orderNumber: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      })
      const json = await res.json()

      if (json.success) {
        if (soundEnabled) playChime('order-ready')
        toast.success(`Pesanan #${orderNumber} SIAP DISAJIKAN! 🥣`, {
          duration: 3500,
        })
        // Update local state immediately for instant feedback
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, orderStatus: 'READY' as OrderStatus } : o))
        )
        fetchOrders(true)
      } else {
        toast.error(json.message || 'Gagal mengubah status pesanan')
      }
    } catch {
      toast.error('Gagal memperbarui status order')
    } finally {
      setUpdatingId(null)
    }
  }

  // Toggle item preparation checkbox
  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Filtered orders list
  const filteredOrders = orders.filter((order) => {
    // Koki strictly sees PAID orders only
    if (order.paymentStatus !== 'PAID') return false

    // Filter by tab
    if (filterMode === 'PROCESSING_ONLY') {
      if (order.orderStatus !== 'PROCESSING') return false
    } else if (filterMode === 'ALL_ACTIVE') {
      // Sedang dimasak atau baru dikonfirmasi untuk dimasak
      if (!['CONFIRMED', 'PROCESSING'].includes(order.orderStatus)) return false
    } else if (filterMode === 'READY_RECENT') {
      if (order.orderStatus !== 'READY') return false
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchNumber = order.orderNumber.toLowerCase().includes(q)
      const matchTable = (order.tableName || '').toLowerCase().includes(q)
      const matchCustomer = (order.customerName || '').toLowerCase().includes(q)
      const matchItems = order.items.some((it) => it.productName.toLowerCase().includes(q))
      if (!matchNumber && !matchTable && !matchCustomer && !matchItems) return false
    }

    return true
  })

  // Summary metrics
  const activeOrders = orders.filter(
    (o) => o.paymentStatus === 'PAID' && ['CONFIRMED', 'PROCESSING'].includes(o.orderStatus)
  )
  const processingCount = orders.filter(
    (o) => o.paymentStatus === 'PAID' && o.orderStatus === 'PROCESSING'
  ).length
  const totalPortionsCooking = activeOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0),
    0
  )
  const readyTodayCount = orders.filter(
    (o) => o.paymentStatus === 'PAID' && o.orderStatus === 'READY'
  ).length

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                <ChefHat className="h-6 w-6 text-white" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Monitor Dapur (KDS)
              </h1>
              {autoRefresh && (
                <span className="flex h-3 w-3 relative ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                </span>
              )}
            </div>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Antrean pesanan lunas yang sedang disiapkan. Tekan tombol <strong className="underline">Tandai Siap Saji</strong> ketika hidangan telah selesai dimasak.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'bg-white/10 hover:bg-white/20 border-white/30 text-white transition-all',
                soundEnabled && 'bg-white/20 font-bold'
              )}
              title={soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi nonaktif'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-4 w-4 mr-1.5 text-emerald-300" />
                  <span>Suara: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4 mr-1.5 opacity-60" />
                  <span>Suara: OFF</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'bg-white/10 hover:bg-white/20 border-white/30 text-white transition-all',
                autoRefresh && 'bg-white/20 font-bold'
              )}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1.5', autoRefresh && 'text-emerald-300')} />
              <span>Auto: {autoRefresh ? '8s' : 'OFF'}</span>
            </Button>

            <Button
              size="sm"
              onClick={() => fetchOrders()}
              disabled={isLoading}
              className="bg-white text-orange-700 hover:bg-white/90 font-bold shadow-md"
            >
              <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
              Segarkan
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-amber-500 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Perlu Dimasak</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {activeOrders.length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pesanan lunas aktif</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sedang Diproses</p>
              <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {processingCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Di wajan / kompor</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <ChefHat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Porsi / Piring</p>
              <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {totalPortionsCooking}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Item menu yang disiapkan</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
              <Utensils className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Siap Disajikan</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {readyTodayCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Menunggu diambil pramusaji</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => setFilterMode('ALL_ACTIVE')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
              filterMode === 'ALL_ACTIVE'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Perlu Dimasak</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white">
              {activeOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('PROCESSING_ONLY')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
              filterMode === 'PROCESSING_ONLY'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <ChefHat className="h-3.5 w-3.5" />
            <span>Sedang Diproses Saja</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white">
              {processingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('READY_RECENT')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
              filterMode === 'READY_RECENT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Baru Siap Saji</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white">
              {readyTodayCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari meja, menu, order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="text-center py-16 bg-card border-dashed">
          <CardContent className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-600">
              <ChefHat className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {filterMode === 'READY_RECENT'
                ? 'Belum ada pesanan siap saji'
                : 'Tidak ada pesanan yang harus dimasak'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {filterMode === 'READY_RECENT'
                ? 'Pesanan yang telah ditandai siap saji akan muncul di sini.'
                : 'Dapur dalam kondisi bersih! Pesanan berbayar baru akan otomatis masuk dan bersuara di monitor ini.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const isReady = order.orderStatus === 'READY'
            const isProcessing = order.orderStatus === 'PROCESSING'
            const isConfirmed = order.orderStatus === 'CONFIRMED'
            const elapsed = formatElapsed(String(order.createdAt), currentTime)

            // Calculate minutes for color-coded urgency
            const diffMinutes = Math.floor(
              (currentTime - new Date(order.createdAt).getTime()) / 60000
            )
            const isUrgent = diffMinutes >= 20
            const isWarning = diffMinutes >= 10 && diffMinutes < 20

            return (
              <Card
                key={order._id}
                className={cn(
                  'border-2 flex flex-col justify-between overflow-hidden shadow-sm transition-all',
                  isReady
                    ? 'border-emerald-500/60 bg-emerald-500/[0.02]'
                    : isUrgent
                    ? 'border-rose-500 shadow-rose-500/10 bg-rose-500/[0.02]'
                    : isWarning
                    ? 'border-amber-400 bg-amber-500/[0.02]'
                    : 'border-border bg-card'
                )}
              >
                <div>
                  {/* Card Header: Table + Time */}
                  <div
                    className={cn(
                      'p-3.5 border-b flex items-start justify-between gap-2',
                      isReady
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : isUrgent
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : isWarning
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-muted/40 border-border'
                    )}
                  >
                    <div>
                      {/* Big Table Badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-base font-black px-2.5 py-0.5 rounded-lg tracking-wide uppercase',
                            order.tableName
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-slate-700 text-white'
                          )}
                        >
                          {order.tableName || 'POS / TAKEAWAY'}
                        </span>
                        {order.source === 'QR' ? (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">
                            QR Meja
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">
                            Kasir POS
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-mono font-bold text-foreground">
                          #{order.orderNumber}
                        </span>
                        {order.customerName && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-foreground">
                              {order.customerName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Timer + Payment Status */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <div
                        className={cn(
                          'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md',
                          isUrgent
                            ? 'bg-rose-500 text-white animate-pulse'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{elapsed}</span>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300/40">
                        ✓ LUNAS
                      </span>
                    </div>
                  </div>

                  {/* Order Notes / Catatan Koki */}
                  {order.notes && (
                    <div className="mx-3.5 mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2 text-amber-900 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold uppercase tracking-wider block text-[10px] text-amber-700 dark:text-amber-400">
                          Catatan Khusus:
                        </span>
                        <span className="font-semibold">{order.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="p-3.5 space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Daftar Masakan ({order.items.reduce((s, it) => s + it.quantity, 0)} porsi):
                    </p>
                    <div className="space-y-1.5">
                      {order.items.map((item, idx) => {
                        const itemKey = `${order._id}-${idx}`
                        const isDone = checkedItems[itemKey] || isReady

                        return (
                          <div
                            key={idx}
                            onClick={() => !isReady && toggleItemCheck(order._id, idx)}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-xl border transition-all select-none',
                              !isReady && 'cursor-pointer hover:bg-muted/60',
                              isDone
                                ? 'bg-muted/30 border-muted opacity-60 line-through'
                                : 'bg-muted/20 border-border'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={cn(
                                  'w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center shrink-0 shadow-sm',
                                  isDone
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-amber-500 text-white'
                                )}
                              >
                                {item.quantity}×
                              </span>
                              <span
                                className={cn(
                                  'text-sm font-bold truncate',
                                  isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                                )}
                              >
                                {item.productName}
                              </span>
                            </div>

                            {!isReady && (
                              <div
                                className={cn(
                                  'w-5 h-5 rounded-md border flex items-center justify-center transition-all',
                                  isDone
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-border hover:border-amber-500'
                                )}
                              >
                                {isDone && <Check className="h-3.5 w-3.5" />}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3.5 border-t border-border/60 bg-muted/20">
                  {isReady ? (
                    <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Makanan Siap Saji (Menunggu Diantar)</span>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => handleMarkAsReady(order._id, order.orderNumber)}
                      disabled={updatingId === order._id}
                      className={cn(
                        'w-full py-3 text-sm font-black text-white shadow-md transition-all flex items-center justify-center gap-2',
                        isUrgent
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      )}
                    >
                      {updatingId === order._id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Utensils className="h-4 w-4" />
                          <span>Tandai Sudah Siap Saji</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
