'use client'

import { useEffect, useState, useCallback } from 'react'
import { Product, StockMovementType } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Layers, AlertTriangle, ArrowUpRight, ArrowDownLeft,
  RefreshCw, PlusCircle, Search, Filter, CheckCircle2,
  Package, TrendingDown, ArrowRightLeft, FileSpreadsheet
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

interface StockMovementItem {
  _id: string
  productName: string
  productId: { _id: string; name: string; sku?: string }
  type: StockMovementType
  quantity: number
  previousStock: number
  newStock: number
  referenceNumber?: string
  notes?: string
  userName?: string
  createdAt: string
}

interface LowStockItem {
  _id: string
  name: string
  sku?: string
  stock: number
  minimumStock: number
  price: number
  categoryId?: { name: string }
}

export default function StockManagementPage() {
  const [movements, setMovements] = useState<StockMovementItem[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<LowStockItem[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [adjustType, setAdjustType] = useState<'RESTOCK' | 'ADJUSTMENT' | 'RETURN'>('RESTOCK')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchStockData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '25')
      if (typeFilter) params.set('type', typeFilter)

      const [stockRes, prodRes] = await Promise.all([
        fetch(`/api/stock?${params.toString()}`),
        fetch('/api/products?limit=100&isActive=true'),
      ])

      const [stockJson, prodJson] = await Promise.all([
        stockRes.json(),
        prodRes.json(),
      ])

      if (stockJson.success) {
        setMovements(stockJson.data.movements || [])
        setLowStockProducts(stockJson.data.lowStockProducts || [])
        setTotalPages(stockJson.data.pagination?.totalPages || 1)
      }

      if (prodJson.success) {
        setAllProducts(prodJson.data || [])
      }
    } catch {
      toast.error('Gagal memuat data stok')
    } finally {
      setIsLoading(false)
    }
  }, [page, typeFilter])

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  const openAdjustForProduct = (prodId: string) => {
    setSelectedProductId(prodId)
    setAdjustType('RESTOCK')
    setQuantity('')
    setNotes('')
    setShowAdjustModal(true)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) {
      toast.error('Pilih produk yang akan disesuaikan')
      return
    }
    const qty = Number(quantity)
    if (!qty || qty === 0) {
      toast.error('Jumlah perubahan stok harus lebih dari 0')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          type: adjustType,
          quantity: adjustType === 'ADJUSTMENT' && qty < 0 ? qty : Math.abs(qty),
          notes,
        }),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(json.message || 'Stok berhasil diperbarui')
        setShowAdjustModal(false)
        fetchStockData()
      } else {
        toast.error(json.message || 'Gagal mengubah stok')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedProduct = allProducts.find((p) => p._id === selectedProductId)

  const filteredMovements = movements.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.productName.toLowerCase().includes(q) ||
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q)) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            Manajemen & Mutasi Stok
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau ketersediaan barang, peringatan stok menipis, dan riwayat pergerakan stok
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStockData}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedProductId(allProducts[0]?._id || '')
              setAdjustType('RESTOCK')
              setQuantity('')
              setNotes('')
              setShowAdjustModal(true)
            }}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Tambah / Sesuaikan Stok
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-amber-400/60 bg-amber-500/[0.03]">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>Peringatan Stok Menipis ({lowStockProducts.length} Produk)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Segera restock untuk menghindari kehabisan menu
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {lowStockProducts.map((p) => {
                const isOutOfStock = p.stock <= 0
                return (
                  <div
                    key={p._id}
                    className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div>
                      <p className="font-semibold text-xs text-foreground line-clamp-1">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={isOutOfStock ? 'destructive' : 'warning'}
                          className="text-[10px] py-0"
                        >
                          {isOutOfStock ? 'Habis (0)' : `Sisa ${p.stock}`}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Min: {p.minimumStock}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 text-primary"
                      onClick={() => openAdjustForProduct(p._id)}
                    >
                      Restock
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement History Table */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base text-foreground">
                Log Mutasi Stok (Stock Movement)
              </h2>
              <p className="text-xs text-muted-foreground">
                Riwayat otomatis setiap penjualan POS, order QR, dan penambahan manual
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari produk / catatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter tipe mutasi stok"
                className="text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Semua Tipe</option>
                <option value="SALE">Penjualan (SALE)</option>
                <option value="RESTOCK">Restock</option>
                <option value="ADJUSTMENT">Penyesuaian (ADJUSTMENT)</option>
                <option value="RETURN">Retur (RETURN)</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 py-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Package className="h-8 w-8 mx-auto opacity-50" />
              <p className="text-sm font-medium">Belum ada riwayat mutasi stok</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2.5">Waktu</th>
                    <th className="px-3.5 py-2.5">Produk</th>
                    <th className="px-3.5 py-2.5">Tipe</th>
                    <th className="px-3.5 py-2.5 text-right">Perubahan</th>
                    <th className="px-3.5 py-2.5 text-right">Stok Awal → Akhir</th>
                    <th className="px-3.5 py-2.5">Ref / Catatan</th>
                    <th className="px-3.5 py-2.5">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMovements.map((m) => {
                    const isPositive = m.quantity > 0
                    return (
                      <tr key={m._id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold text-foreground">
                          {m.productName}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <Badge
                            variant={
                              m.type === 'SALE'
                                ? 'outline'
                                : m.type === 'RESTOCK'
                                ? 'success'
                                : m.type === 'RETURN'
                                ? 'info'
                                : 'secondary'
                            }
                            className="text-[10px] py-0"
                          >
                            {m.type === 'SALE'
                              ? 'Penjualan'
                              : m.type === 'RESTOCK'
                              ? 'Restock Masuk'
                              : m.type === 'RETURN'
                              ? 'Retur'
                              : 'Penyesuaian'}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                          <span
                            className={cn(
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            )}
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {m.previousStock} → <strong className="text-foreground">{m.newStock}</strong>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground max-w-xs truncate">
                          {m.referenceNumber && (
                            <span className="font-mono text-foreground mr-1.5">
                              #{m.referenceNumber}
                            </span>
                          )}
                          {m.notes || '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap">
                          {m.userName || 'Sistem'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Sebelumnya
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Penyesuaian / Restock Stok"
        size="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Pilih Produk
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full text-sm rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            >
              <option value="">-- Pilih Produk --</option>
              {allProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} (Stok Saat Ini: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 rounded-lg bg-muted/40 text-xs flex justify-between">
              <div>
                <span className="text-muted-foreground">Stok saat ini:</span>
                <p className="font-bold text-sm text-foreground">{selectedProduct.stock} unit</p>
              </div>
              <div>
                <span className="text-muted-foreground">Minimum Stok:</span>
                <p className="font-bold text-sm text-foreground">{selectedProduct.minimumStock} unit</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Tipe Penyesuaian
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'RESTOCK' as const, label: 'Restock (+)' },
                { type: 'ADJUSTMENT' as const, label: 'Opname (+/-)' },
                { type: 'RETURN' as const, label: 'Retur (+)' },
              ].map((btn) => (
                <button
                  key={btn.type}
                  type="button"
                  onClick={() => setAdjustType(btn.type)}
                  className={cn(
                    'p-2 text-xs font-medium rounded-lg border text-center transition-all',
                    adjustType === btn.type
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border bg-background hover:bg-muted text-muted-foreground'
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Jumlah Perubahan Unit:
            </label>
            <Input
              type="number"
              placeholder="Contoh: 10, 50, -5 (jika barang rusak)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
            {selectedProduct && typeof quantity === 'number' && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Estimasi stok setelah perubahan:{' '}
                <strong className="text-foreground">
                  {selectedProduct.stock + (adjustType === 'ADJUSTMENT' ? quantity : Math.abs(quantity))} unit
                </strong>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Catatan / Keterangan (Opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Kiriman supplier faktur #9821, expired, stock opname akhir bulan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdjustModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Stok'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
