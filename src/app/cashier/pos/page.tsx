'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, getQuickCashAmounts } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  ChevronRight,
  Package,
  X,
  Percent,
  Tag,
  CheckCircle,
  Printer,
  RefreshCw,
  TrendingUp,
  Flame,
  Calendar,
  Layers,
  Sparkles,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Skeleton, Badge } from '@/components/ui/Card'
import { Product, Category, Order } from '@/types'
import { cn } from '@/lib/cn'
import { ReceiptModal } from '@/components/receipt/ReceiptModal'

export default function POSPage() {
  const { user } = useAuthStore()
  const cart = useCartStore()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [posMode, setPosMode] = useState<'STOCK' | 'SALES' | 'HYBRID'>('STOCK')
  const [salesFilter, setSalesFilter] = useState<'ALL' | 'TOP_TODAY' | 'TOP_MONTH'>('ALL')
  const [settings, setSettings] = useState<{
    taxEnabled: boolean
    taxPercentage: number
    discountEnabled: boolean
    midtransClientKey?: string
    midtransIsProduction?: boolean
    defaultProductViewMode?: 'STOCK' | 'SALES' | 'HYBRID'
  }>({
    taxEnabled: false,
    taxPercentage: 0,
    discountEnabled: true,
  })

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MIDTRANS'>('CASH')
  const [cashInput, setCashInput] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Success states
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  // Discount
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('FIXED')

  const searchRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setIsLoadingProducts(true)
    try {
      const [productsRes, categoriesRes, settingsRes] = await Promise.all([
        fetch('/api/products?isActive=true&limit=100'),
        fetch('/api/categories?isActive=true'),
        fetch('/api/settings'),
      ])

      const productsData = await productsRes.json()
      const categoriesData = await categoriesRes.json()
      const settingsData = await settingsRes.json()

      if (productsData.success) setProducts(productsData.data)
      if (categoriesData.success) setCategories(categoriesData.data)
      if (settingsData.success) {
        setSettings({
          taxEnabled: settingsData.data.taxEnabled,
          taxPercentage: settingsData.data.taxPercentage,
          discountEnabled: settingsData.data.discountEnabled,
          midtransClientKey: settingsData.data.midtransClientKey,
          midtransIsProduction: settingsData.data.midtransIsProduction,
          defaultProductViewMode: settingsData.data.defaultProductViewMode,
        })
        if (settingsData.data.defaultProductViewMode) {
          setPosMode(settingsData.data.defaultProductViewMode)
        }
      }
    } catch {
      toast.error('Gagal memuat data produk')
    } finally {
      setIsLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Keyboard shortcut: Press "/" to focus search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const filteredProducts = products
    .filter((p) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        (typeof p.categoryId === 'object'
          ? p.categoryId._id === selectedCategory
          : p.categoryId === selectedCategory)
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      if (salesFilter === 'TOP_TODAY') {
        return (b.soldToday || 0) - (a.soldToday || 0)
      }
      if (salesFilter === 'TOP_MONTH') {
        return (b.soldThisMonth || 0) - (a.soldThisMonth || 0)
      }
      return 0
    })

  const subtotal = cart.getSubtotal()
  const discountAmount = cart.getDiscountAmount(subtotal)
  const taxAmount = settings.taxEnabled ? cart.getTaxAmount(subtotal, settings.taxPercentage) : 0
  const total = subtotal - discountAmount + taxAmount
  const cashChange = cashInput ? parseFloat(cashInput.replace(/\./g, '').replace(',', '.')) - total : 0

  const handleCashInputChange = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, '')
    const formatted = numeric ? parseInt(numeric).toLocaleString('id-ID') : ''
    setCashInput(formatted)
  }

  const quickCash = getQuickCashAmounts(total)

  const handlePayment = async () => {
    if (cart.items.length === 0) {
      toast.error('Keranjang kosong')
      return
    }

    if (paymentMethod === 'CASH') {
      const cashAmount = parseFloat(cashInput.replace(/\./g, '').replace(',', '.'))
      if (!cashAmount || cashAmount < total) {
        toast.error('Jumlah uang tidak mencukupi')
        return
      }
    }

    setIsProcessing(true)
    try {
      const cashAmount = paymentMethod === 'CASH'
        ? parseFloat(cashInput.replace(/\./g, '').replace(',', '.'))
        : undefined

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'POS',
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod,
          cashAmount,
          customerEmail: customerEmail.trim() || undefined,
          discount: cart.discount,
          discountType: cart.discountType,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.message || 'Pembayaran gagal')
        return
      }

      if (paymentMethod === 'CASH') {
        setCompletedOrder(result.data)
        setShowPaymentModal(false)
        setShowReceipt(true)
        cart.clearCart()
        setCustomerEmail('')
        setCashInput('')
        toast.success('Transaksi berhasil!')
        fetchData() // Refresh products to update stock
      } else {
        // Midtrans flow
        const tokenRes = await fetch('/api/payments/midtrans/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: result.data._id }),
        })
        const tokenData = await tokenRes.json()

        if (!tokenData.success) {
          toast.error(tokenData.message || 'Gagal membuat token pembayaran')
          return
        }

        // Open Midtrans Snap
        if (typeof window !== 'undefined' && (window as any).snap) {
          ;(window as any).snap.pay(tokenData.data.token, {
            onSuccess: async () => {
              toast.loading('Memverifikasi pembayaran...', { id: 'midtrans-pos-sync' })
              try {
                await fetch('/api/payments/midtrans/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: result.data._id }),
                })
              } catch {}
              toast.dismiss('midtrans-pos-sync')

              const orderRes = await fetch(`/api/orders/${result.data._id}`)
              const orderData = await orderRes.json()
              if (orderData.success) {
                setCompletedOrder(orderData.data)
                setShowPaymentModal(false)
                setShowReceipt(true)
                cart.clearCart()
                setCustomerEmail('')
                setCashInput('')
                toast.success('Pembayaran berhasil dikonfirmasi!')
                fetchData()
              }
            },
            onPending: () => {
              toast.info('Pembayaran menunggu konfirmasi atau sedang diproses')
              fetchData()
            },
            onError: () => toast.error('Pembayaran Midtrans gagal'),
            onClose: () => {
              toast.info('Jendela pembayaran ditutup. Anda dapat memeriksa status kapan saja.')
              fetchData()
            },
          })
        } else {
          toast.error('Midtrans Snap tidak tersedia')
        }
      }
    } catch {
      toast.error('Terjadi kesalahan saat memproses pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const applyDiscount = () => {
    const discount = parseFloat(discountInput) || 0
    cart.setDiscount(discount, discountType)
    setShowDiscountModal(false)
    toast.success('Diskon diterapkan')
  }

  return (
    <>
      {/* Midtrans Snap script */}
      <script
        src={`https://app${(settings.midtransIsProduction ?? (process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true')) ? '' : '.sandbox'}.midtrans.com/snap/snap.js`}
        data-client-key={settings.midtransClientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        async
      />

      <div className="flex h-full overflow-hidden bg-muted/30">
        {/* Product Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Search & Filter Header */}
          <div className="bg-background border-b border-border p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk... (tekan / untuk fokus)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Mode Switcher: Mode Stok vs Mode Data Penjual */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setPosMode('STOCK')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
                      posMode === 'STOCK'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Mode Stok: Menampilkan persediaan dan sisa stok fisik produk"
                  >
                    <Package className="h-3.5 w-3.5 text-amber-500" />
                    <span className="hidden md:inline">Mode Stok</span>
                    <span className="md:hidden">Stok</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosMode('SALES')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
                      posMode === 'SALES'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Mode Data Penjual: Menampilkan performa produk terjual hari ini & bulan ini"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Data Penjual</span>
                    <span className="md:hidden">Penjual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosMode('HYBRID')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1',
                      posMode === 'HYBRID'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Kombinasi: Menampilkan stok dan data penjualan bersamaan"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Kombinasi</span>
                  </button>
                </div>

                <Button variant="outline" size="sm" onClick={fetchData} title="Muat ulang data">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Category filter & Quick Best Seller Sorting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
              {/* Category pills */}
              <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    selectedCategory === 'all'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  Semua Kategori
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => setSelectedCategory(cat._id)}
                    className={cn(
                      'flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all',
                      selectedCategory === cat._id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Best Seller quick sort filters */}
              <div className="flex items-center gap-1.5 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setSalesFilter(salesFilter === 'TOP_TODAY' ? 'ALL' : 'TOP_TODAY')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1 border text-xs',
                    salesFilter === 'TOP_TODAY'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold shadow-sm'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Flame className="h-3 w-3 text-amber-500" />
                  <span>Terlaris Hari Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSalesFilter(salesFilter === 'TOP_MONTH' ? 'ALL' : 'TOP_MONTH')}
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1 border text-xs',
                    salesFilter === 'TOP_MONTH'
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Calendar className="h-3 w-3 text-indigo-500" />
                  <span>Terlaris Bulan Ini</span>
                </button>
                {salesFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSalesFilter('ALL')}
                    className="text-xs text-muted-foreground hover:text-foreground underline px-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">Produk tidak ditemukan</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Coba ubah filter atau pencarian</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((product) => {
                  const cartItem = cart.items.find((i) => i.productId === product._id)
                  const shouldTrackStock = product.trackStock !== false && product.productMode !== 'SALES'
                  const isOutOfStock = shouldTrackStock && product.stock === 0
                  const isLowStock = shouldTrackStock && product.stock > 0 && product.stock <= product.minimumStock
                  const soldToday = product.soldToday || 0
                  const soldMonth = product.soldThisMonth || 0

                  return (
                    <button
                      key={product._id}
                      onClick={() => {
                        if (isOutOfStock) {
                          toast.error(`${product.name} sudah habis`)
                          return
                        }
                        if (shouldTrackStock && cartItem && cartItem.quantity >= product.stock) {
                          toast.error(`Stok ${product.name} tidak mencukupi`)
                          return
                        }
                        cart.addItem(product)
                      }}
                      disabled={isOutOfStock}
                      className={cn(
                        'product-card text-left p-0 flex flex-col justify-between overflow-hidden transition-all hover:scale-[1.01] hover:shadow-md border border-border/70',
                        isOutOfStock && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {/* Product Image */}
                      <div className="relative w-full aspect-square bg-muted rounded-t-xl overflow-hidden">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}

                        {/* Out of stock overlay */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="text-xs font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2.5 py-1">
                              HABIS
                            </span>
                          </div>
                        )}

                        {/* Top Left: Badges depending on mode */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                          {/* In SALES or HYBRID mode: Show today's sales badge */}
                          {(posMode === 'SALES' || posMode === 'HYBRID') && (
                            <div className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-md",
                              soldToday > 0
                                ? "bg-emerald-600/90 text-white"
                                : "bg-black/60 text-white/80"
                            )}>
                              <Flame className={cn("h-3 w-3", soldToday > 0 ? "text-amber-300" : "text-white/60")} />
                              <span>Hari ini: {soldToday}</span>
                            </div>
                          )}

                          {/* In STOCK mode with no stock tracking: Made to order / unlimited badge */}
                          {posMode === 'STOCK' && !shouldTrackStock && (
                            <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600/90 text-white shadow-sm">
                              Tersedia
                            </div>
                          )}
                        </div>

                        {/* Cart quantity badge */}
                        {cartItem && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg ring-2 ring-background">
                            {cartItem.quantity}
                          </div>
                        )}

                        {/* Bottom Banner depending on mode */}
                        {/* 1. STOCK mode: Low stock warning */}
                        {posMode === 'STOCK' && isLowStock && (
                          <div className="absolute bottom-0 left-0 right-0 bg-orange-500/95 text-white text-[11px] font-semibold text-center py-0.5">
                            Sisa Stok: {product.stock}
                          </div>
                        )}

                        {/* 2. SALES mode: This month sales banner */}
                        {posMode === 'SALES' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/85 backdrop-blur text-white text-[10px] font-medium text-center py-0.5 flex items-center justify-center gap-1">
                            <Calendar className="h-3 w-3 text-indigo-400" />
                            <span>Bulan ini: <strong className="text-indigo-300">{soldMonth}</strong> terjual</span>
                          </div>
                        )}

                        {/* 3. HYBRID mode: Stock + Month sales */}
                        {posMode === 'HYBRID' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/85 backdrop-blur text-white text-[10px] font-medium text-center py-0.5 flex items-center justify-between px-2">
                            <span>{shouldTrackStock ? `Stok: ${product.stock}` : 'Stok: ∞'}</span>
                            <span className="text-indigo-300">Bln: {soldMonth} terjual</span>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-3">
                        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                          {product.name}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-sm font-bold text-primary">
                            {formatCurrency(product.price)}
                          </p>
                          {/* Stock pill for normal stock mode if plenty */}
                          {posMode === 'STOCK' && shouldTrackStock && !isLowStock && !isOutOfStock && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {product.stock} pcs
                            </span>
                          )}
                          {/* Sales counter in SALES mode */}
                          {posMode === 'SALES' && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              Total: {product.soldTotal || 0}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-80 xl:w-96 flex flex-col bg-background border-l border-border flex-shrink-0">
          {/* Cart Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Keranjang</span>
              {cart.items.length > 0 && (
                <Badge variant="default">{cart.getItemCount()}</Badge>
              )}
            </div>
            {cart.items.length > 0 && (
              <button
                onClick={() => cart.clearCart()}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Kosongkan
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <ShoppingCart className="h-14 w-14 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">Keranjang kosong</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Klik produk untuk menambahkan</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {cart.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right flex-shrink-0 min-w-[70px]">
                      <p className="text-sm font-bold text-foreground">
                        {formatCurrency(item.subtotal)}
                      </p>
                      <button
                        onClick={() => cart.removeItem(item.productId)}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          {cart.items.length > 0 && (
            <div className="border-t border-border p-4 space-y-3">
              {/* Subtotal */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({cart.getItemCount()} item)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {/* Discount */}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>
                      Diskon {cart.discountType === 'PERCENTAGE' ? `(${cart.discount}%)` : ''}
                    </span>
                    <span>- {formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {/* Tax */}
                {settings.taxEnabled && taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak ({settings.taxPercentage}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Discount button */}
              {settings.discountEnabled && (
                <button
                  onClick={() => setShowDiscountModal(true)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground hover:text-primary"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span>Tambah Diskon</span>
                  </div>
                  {discountAmount > 0 && (
                    <span className="text-green-500 font-medium">
                      -{formatCurrency(discountAmount)}
                    </span>
                  )}
                </button>
              )}

              {/* Pay Button */}
              <Button
                size="lg"
                className="w-full text-base font-bold shadow-lg shadow-primary/25"
                onClick={() => {
                  setCashInput('')
                  setCustomerEmail('')
                  setShowPaymentModal(true)
                }}
              >
                <Banknote className="h-5 w-5" />
                BAYAR {formatCurrency(total)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => !isProcessing && setShowPaymentModal(false)}
        title="Proses Pembayaran"
        size="md"
      >
        <div className="space-y-5">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon</span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            {settings.taxEnabled && taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  paymentMethod === 'CASH'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Banknote className={cn('h-7 w-7', paymentMethod === 'CASH' ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', paymentMethod === 'CASH' ? 'text-primary' : 'text-muted-foreground')}>
                  Tunai
                </span>
              </button>
              <button
                onClick={() => setPaymentMethod('MIDTRANS')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  paymentMethod === 'MIDTRANS'
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-border hover:border-blue-400/40'
                )}
              >
                <CreditCard className={cn('h-7 w-7', paymentMethod === 'MIDTRANS' ? 'text-blue-500' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', paymentMethod === 'MIDTRANS' ? 'text-blue-500' : 'text-muted-foreground')}>
                  Midtrans
                </span>
              </button>
            </div>
          </div>

          {/* Cash Input */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Uang Diterima
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={cashInput}
                    onChange={(e) => handleCashInputChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-3 text-lg font-bold border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all text-right"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick cash amounts */}
              <div className="grid grid-cols-4 gap-2">
                {quickCash.map((amount, i) => (
                  <button
                    key={i}
                    onClick={() => setCashInput(amount.toLocaleString('id-ID'))}
                    className={cn(
                      'py-2 px-2 rounded-lg text-sm font-medium transition-colors text-center',
                      amount === total
                        ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-semibold'
                        : 'bg-muted hover:bg-primary/10 hover:text-primary text-foreground'
                    )}
                  >
                    {amount === total
                      ? 'Uang Pas'
                      : amount >= 1000000
                      ? `${(amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1)}Jt`
                      : amount >= 1000
                      ? `${(amount / 1000).toFixed(0)}Rb`
                      : formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {/* Change */}
              {cashInput && (
                <div className={cn(
                  'flex justify-between items-center p-4 rounded-xl text-lg font-bold',
                  cashChange >= 0
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                )}>
                  <span>Kembalian</span>
                  <span>{formatCurrency(Math.max(0, cashChange))}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer Email (optional) */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Pelanggan
              <span className="text-xs font-normal text-muted-foreground/70 ml-1">(opsional — untuk struk digital)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="contoh@email.com"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
            {customerEmail.trim() && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Struk akan dikirim ke email ini setelah pembayaran
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPaymentModal(false)}
              className="flex-1"
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1 font-bold"
              isLoading={isProcessing}
              disabled={paymentMethod === 'CASH' && cashChange < 0}
            >
              {paymentMethod === 'CASH' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Konfirmasi
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Bayar via Midtrans
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="Tambah Diskon"
        size="sm"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDiscountType('FIXED')}
              className={cn(
                'py-2 rounded-lg border text-sm font-medium transition-all',
                discountType === 'FIXED'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground'
              )}
            >
              Nominal (Rp)
            </button>
            <button
              onClick={() => setDiscountType('PERCENTAGE')}
              className={cn(
                'py-2 rounded-lg border text-sm font-medium transition-all',
                discountType === 'PERCENTAGE'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground'
              )}
            >
              <Percent className="h-3.5 w-3.5 inline mr-1" />
              Persen
            </button>
          </div>

          <Input
            label={discountType === 'PERCENTAGE' ? 'Persentase Diskon (%)' : 'Nominal Diskon (Rp)'}
            type="number"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            placeholder={discountType === 'PERCENTAGE' ? 'contoh: 10' : 'contoh: 5000'}
            min={0}
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            autoFocus
          />

          {discountInput && (
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-green-600 mt-1">
                <span>Diskon</span>
                <span>
                  - {formatCurrency(
                    discountType === 'PERCENTAGE'
                      ? Math.round(subtotal * (parseFloat(discountInput) / 100))
                      : Math.min(parseFloat(discountInput), subtotal)
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                cart.setDiscount(0)
                setDiscountInput('')
                setShowDiscountModal(false)
              }}
              className="flex-1"
            >
              Hapus Diskon
            </Button>
            <Button onClick={applyDiscount} className="flex-1">
              Terapkan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      {completedOrder && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => {
            setShowReceipt(false)
            setCompletedOrder(null)
          }}
          order={completedOrder}
        />
      )}
    </>
  )
}
