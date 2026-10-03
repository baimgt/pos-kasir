'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Product, Category } from '@/types'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Plus,
  Minus,
  Package,
  CheckCircle,
  X,
  MapPin,
  ChevronRight,
  Loader2,
  Clock,
  Banknote,
  AlertCircle,
  RefreshCw,
  PartyPopper,
  CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface MenuData {
  table: { _id: string; name: string; tableNumber: string }
  settings: {
    storeName: string
    storeAddress?: string
    taxEnabled: boolean
    taxPercentage: number
    cashPaymentEnabled: boolean
    midtransEnabled: boolean
    currencySymbol: string
    midtransClientKey?: string
    midtransIsProduction?: boolean
  }
  categories: Category[]
  products: Product[]
}

type CheckoutStep = 'menu' | 'cart' | 'checkout' | 'waiting_payment' | 'paid'

interface OrderStatus {
  orderNumber: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  total: number
}

export default function QROrderPage() {
  const params = useParams()
  const token = params.token as string
  const cart = useCartStore()

  const [menuData, setMenuData] = useState<MenuData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [step, setStep] = useState<CheckoutStep>('menu')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MIDTRANS'>('CASH')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderId, setOrderId] = useState('')
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    cart.clearCart()
    fetchMenu()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchMenu = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/order/menu?token=${token}`)
      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Meja tidak ditemukan')
        return
      }

      setMenuData(data.data)
      if (data.data.settings.cashPaymentEnabled) {
        setPaymentMethod('CASH')
      } else if (data.data.settings.midtransEnabled) {
        setPaymentMethod('MIDTRANS')
      }
    } catch {
      setError('Terjadi kesalahan. Coba refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }

  // Poll order payment status for cash orders
  const pollOrderStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/order/status?orderId=${id}`)
      const data = await res.json()
      if (data.success) {
        setOrderStatus(data.data)
        if (data.data.paymentStatus === 'PAID') {
          // Stop polling — payment confirmed by cashier
          if (pollingRef.current) clearInterval(pollingRef.current)
          pollingRef.current = null
          setStep('paid')
        }
      }
    } catch {
      // silent fail for background poll
    }
  }, [])

  // Start polling when on waiting_payment step
  useEffect(() => {
    if (step === 'waiting_payment' && orderId) {
      pollOrderStatus(orderId) // immediate first check
      pollingRef.current = setInterval(() => {
        pollOrderStatus(orderId)
      }, 5000)
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, orderId, pollOrderStatus])

  const filteredProducts = menuData?.products.filter((p) => {
    if (selectedCategory === 'all') return true
    const catId = typeof p.categoryId === 'object' ? (p.categoryId as { _id: string })._id : p.categoryId
    return catId === selectedCategory
  }) || []

  const subtotal = cart.getSubtotal()
  const taxAmount = menuData?.settings.taxEnabled
    ? Math.round(subtotal * ((menuData.settings.taxPercentage || 0) / 100))
    : 0
  const total = subtotal + taxAmount

  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      toast.error('Pilih produk terlebih dahulu')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/order/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'QR',
          tableToken: token,
          items: cart.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          paymentMethod,
          customerName: customerName || undefined,
          customerEmail: customerEmail.trim() || undefined,
          notes: notes || undefined,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        toast.error(data.message || 'Gagal membuat pesanan')
        return
      }

      setOrderNumber(data.data.orderNumber)
      setOrderId(data.data._id)
      cart.clearCart()

      if (paymentMethod === 'MIDTRANS') {
        const tokenRes = await fetch('/api/payments/midtrans/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.data._id }),
        })
        const tokenData = await tokenRes.json()

        if (!tokenData.success) {
          toast.error('Gagal membuat token pembayaran')
          // Fallback to waiting screen
          setStep('waiting_payment')
          return
        }

        if ((window as unknown as Record<string, unknown>).snap) {
          ;((window as unknown as Record<string, unknown>).snap as { pay: (token: string, options: Record<string, () => void>) => void }).pay(tokenData.data.token, {
            onSuccess: async () => {
              try {
                await fetch('/api/payments/midtrans/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: data.data._id }),
                })
              } catch {}
              setStep('paid')
            },
            onPending: () => {
              setStep('waiting_payment')
              pollOrderStatus(data.data._id)
            },
            onError: () => toast.error('Pembayaran gagal atau dibatalkan'),
            onClose: () => {
              setStep('waiting_payment')
              pollOrderStatus(data.data._id)
            },
          })
        } else {
          setStep('waiting_payment')
        }
      } else {
        // CASH — show waiting for cashier confirmation
        setStep('waiting_payment')
      }
    } catch {
      toast.error('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetOrder = () => {
    setStep('menu')
    setOrderNumber('')
    setOrderId('')
    setOrderStatus(null)
    setCustomerName('')
    setCustomerEmail('')
    setNotes('')
    cart.clearCart()
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Memuat menu...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <X className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Oops!</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={fetchMenu}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  // ── Waiting for payment / cashier confirmation ────────────────────────────
  if (step === 'waiting_payment') {
    const isCash = paymentMethod === 'CASH'
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6 text-center">

          {/* Animated icon */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            <div className="relative w-28 h-28 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border-4 border-amber-400">
              {isCash
                ? <Banknote className="h-12 w-12 text-amber-500" />
                : <Clock className="h-12 w-12 text-amber-500 animate-spin-slow" />
              }
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-black text-foreground">
              {isCash ? 'Bayar ke Kasir 💵' : 'Menunggu Pembayaran'}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {isCash
                ? 'Pesanan Anda telah diterima. Silakan tunjukkan nomor pesanan di bawah ke kasir untuk melakukan pembayaran tunai.'
                : 'Selesaikan pembayaran Anda. Halaman ini akan otomatis diperbarui setelah pembayaran dikonfirmasi.'
              }
            </p>
          </div>

          {/* Order detail card */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">No. Pesanan</span>
              <span className="text-xl font-black text-primary tracking-wider">{orderNumber}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Meja</span>
              <span className="font-semibold text-foreground">{menuData?.table.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Tagihan</span>
              <span className="font-black text-lg text-foreground">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pembayaran</span>
              <span className={cn(
                'font-medium px-2 py-0.5 rounded-full text-xs',
                isCash ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                       : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              )}>
                {isCash ? '💵 Tunai' : '💳 Digital'}
              </span>
            </div>
          </div>

          {/* Cash instruction */}
          {isCash && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-left space-y-2">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Cara Bayar Tunai
              </p>
              <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Pergi ke meja kasir atau panggil pelayan</li>
                <li>Tunjukkan nomor pesanan <strong>{orderNumber}</strong></li>
                <li>Bayarkan total <strong>{formatCurrency(total)}</strong></li>
                <li>Halaman ini otomatis berubah setelah kasir konfirmasi</li>
              </ol>
            </div>
          )}

          {/* Digital / Midtrans instruction */}
          {!isCash && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-left space-y-2">
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <CreditCard className="h-4 w-4 shrink-0" />
                Pembayaran Digital / QRIS
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Setelah Anda menyelesaikan pembayaran pada popup Midtrans, status akan otomatis terverifikasi dan pesanan Anda langsung diproses.
              </p>
            </div>
          )}

          {/* Auto-refresh indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Memperbarui status secara otomatis setiap 5 detik...</span>
          </div>

          {/* Manual refresh */}
          <button
            onClick={() => pollOrderStatus(orderId)}
            className="w-full py-3 border-2 border-primary/30 text-primary rounded-xl font-medium hover:bg-primary/5 transition-colors text-sm"
          >
            Cek Status Sekarang
          </button>
        </div>
      </div>
    )
  }

  // ── Payment confirmed / Paid ──────────────────────────────────────────────
  if (step === 'paid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm w-full">
          {/* Celebration icon */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
            <div className="relative w-28 h-28 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center border-4 border-green-400">
              <PartyPopper className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-foreground">Pembayaran Lunas! 🎉</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Terima kasih! Pesanan Anda sedang diproses oleh dapur kami.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">No. Pesanan</span>
              <span className="font-black text-primary">{orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Meja</span>
              <span className="font-semibold text-foreground">{menuData?.table.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Dibayar</span>
              <span className="font-black text-foreground">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium px-2 py-0.5 rounded-full text-xs">
                ✅ Lunas
              </span>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              🍽️ Pesanan Anda sedang disiapkan. Mohon tunggu di meja <strong>{menuData?.table.name}</strong>.
            </p>
          </div>

          <button
            onClick={resetOrder}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:bg-primary/90 transition-all"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    )
  }

  // ── Main order UI ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Midtrans Snap */}
      <script
        src={`https://app${(menuData?.settings?.midtransIsProduction ?? (process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true')) ? '' : '.sandbox'}.midtrans.com/snap/snap.js`}
        data-client-key={menuData?.settings?.midtransClientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        async
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div>
              <h1 className="text-lg font-bold text-foreground">{menuData?.settings.storeName}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {menuData?.table.name}
              </p>
            </div>

            {/* Cart button */}
            {step === 'menu' && cart.items.length > 0 && (
              <button
                onClick={() => setStep('cart')}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg shadow-primary/25"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>{cart.getItemCount()}</span>
                <span className="font-bold">{formatCurrency(total)}</span>
              </button>
            )}

            {(step === 'cart' || step === 'checkout') && (
              <button onClick={() => setStep(step === 'checkout' ? 'cart' : 'menu')} className="text-muted-foreground">
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
        </header>

        {/* Category tabs */}
        {step === 'menu' && (
          <div className="sticky top-[57px] z-10 bg-background border-b border-border">
            <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-thin max-w-lg mx-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                Semua
              </button>
              {menuData?.categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat._id)}
                  className={cn(
                    'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                    selectedCategory === cat._id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto">
          {/* Menu Step */}
          {step === 'menu' && (
            <div className="p-4 pb-28 grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const cartItem = cart.items.find((i) => i.productId === product._id)
                const isOutOfStock = product.stock === 0

                return (
                  <div
                    key={product._id}
                    className={cn(
                      'bg-card rounded-2xl border border-border overflow-hidden',
                      'transition-all duration-200',
                      isOutOfStock && 'opacity-60'
                    )}
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-muted">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground/20" />
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <span className="text-xs font-bold text-destructive bg-background rounded-full px-2 py-1">
                            HABIS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                        {product.name}
                      </p>
                      <p className="text-sm font-bold text-primary mt-1">
                        {formatCurrency(product.price)}
                      </p>

                      {isOutOfStock ? (
                        <div className="mt-2 text-center">
                          <span className="text-xs text-destructive">Stok habis</span>
                        </div>
                      ) : cartItem ? (
                        <div className="flex items-center justify-between mt-2">
                          <button
                            onClick={() => cart.updateQuantity(product._id, cartItem.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-bold">{cartItem.quantity}</span>
                          <button
                            onClick={() => cart.updateQuantity(product._id, cartItem.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => cart.addItem(product)}
                          className="w-full mt-2 py-1.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          + Tambah
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">Tidak ada produk tersedia</p>
                </div>
              )}
            </div>
          )}

          {/* Cart Step */}
          {step === 'cart' && (
            <div className="p-4 space-y-4">
              <h2 className="text-xl font-bold text-foreground">Keranjang Pesanan</h2>

              <div className="space-y-3">
                {cart.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold w-20 text-right">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak ({menuData?.settings.taxPercentage}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <button
                onClick={() => setStep('checkout')}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
              >
                Lanjut ke Pembayaran
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Checkout Step */}
          {step === 'checkout' && (
            <div className="p-4 space-y-5 pb-8">
              <h2 className="text-xl font-bold text-foreground">Detail Pesanan</h2>

              {/* Customer Name */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Nama (Opsional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Anda"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
                />
              </div>

              {/* Customer Email */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Email (Opsional — untuk struk digital)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
                />
                {customerEmail.trim() && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Struk pembayaran akan dikirim ke email ini setelah lunas
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: tanpa bawang, pedas level 3..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all resize-none"
                />
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Metode Pembayaran</p>
                <div className="space-y-2">
                  {menuData?.settings.cashPaymentEnabled && (
                    <button
                      onClick={() => setPaymentMethod('CASH')}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                        paymentMethod === 'CASH'
                          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                          : 'border-border'
                      )}
                    >
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', paymentMethod === 'CASH' ? 'border-amber-500' : 'border-muted-foreground')}>
                        {paymentMethod === 'CASH' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">💵 Bayar Tunai ke Kasir</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Setelah pesan, bawa nomor pesanan ke kasir untuk membayar</p>
                      </div>
                    </button>
                  )}
                  {menuData?.settings.midtransEnabled && (
                    <button
                      onClick={() => setPaymentMethod('MIDTRANS')}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                        paymentMethod === 'MIDTRANS'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                          : 'border-border'
                      )}
                    >
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', paymentMethod === 'MIDTRANS' ? 'border-blue-500' : 'border-muted-foreground')}>
                        {paymentMethod === 'MIDTRANS' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">💳 Bayar Digital (Midtrans)</p>
                        <p className="text-xs text-muted-foreground mt-0.5">QRIS, transfer bank, kartu kredit/debit</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Tip for CASH */}
              {paymentMethod === 'CASH' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Setelah menekan <strong>Pesan Sekarang</strong>, Anda akan mendapat nomor pesanan. Bawa nomor tersebut ke kasir untuk membayar tunai sebesar <strong>{formatCurrency(total)}</strong>.
                  </p>
                </div>
              )}

              {/* Order summary */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-foreground mb-3">Ringkasan Pesanan</p>
                {cart.items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-muted-foreground">
                    <span>{item.productName} x{item.quantity}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak ({menuData?.settings.taxPercentage}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Pesan Sekarang
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Floating cart button on menu page */}
        {step === 'menu' && cart.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border safe-area-bottom">
            <button
              onClick={() => setStep('cart')}
              className="w-full max-w-lg mx-auto flex items-center justify-between py-4 px-6 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">
                  {cart.getItemCount()}
                </div>
                <span>Lihat Keranjang</span>
              </div>
              <span>{formatCurrency(total)}</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
