'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, ProductInput } from '@/lib/validations'
import { Product, Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle,
  X, Upload, RefreshCw, ToggleLeft, ToggleRight,
  TrendingUp, Flame, Calendar, Layers, BarChart2, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [tableViewMode, setTableViewMode] = useState<'STOCK' | 'SALES'>('STOCK')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      isActive: true,
      stock: 0,
      minimumStock: 5,
      price: 0,
      costPrice: 0,
      trackStock: true,
      productMode: 'STOCK',
    },
  })

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.append('search', search)
      if (selectedCategory) params.append('category', selectedCategory)

      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/products?${params}`),
        fetch('/api/categories?isActive=true'),
      ])

      const productsData = await productsRes.json()
      const categoriesData = await categoriesRes.json()

      if (productsData.success) {
        setProducts(productsData.data)
        setTotalPages(productsData.pagination.totalPages)
      }
      if (categoriesData.success) setCategories(categoriesData.data)
    } catch {
      toast.error('Gagal memuat data produk')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, selectedCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreateModal = () => {
    reset({
      isActive: true,
      stock: 0,
      minimumStock: 5,
      price: 0,
      costPrice: 0,
      trackStock: true,
      productMode: 'STOCK',
    })
    setEditingProduct(null)
    setShowModal(true)
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    reset({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      description: product.description || '',
      image: product.image || '',
      price: product.price,
      costPrice: product.costPrice || 0,
      stock: product.stock,
      minimumStock: product.minimumStock,
      trackStock: product.trackStock !== false,
      productMode: product.productMode || (product.trackStock === false ? 'SALES' : 'STOCK'),
      categoryId: typeof product.categoryId === 'object' ? product.categoryId._id : product.categoryId,
      isActive: product.isActive,
    })
    setShowModal(true)
  }

  const onSubmit = async (data: ProductInput) => {
    setIsSubmitting(true)
    try {
      const url = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!result.success) {
        toast.error(result.message || 'Operasi gagal')
        return
      }

      toast.success(editingProduct ? 'Produk berhasil diperbarui' : 'Produk berhasil dibuat')
      setShowModal(false)
      fetchData()
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProduct) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteProduct._id}`, { method: 'DELETE' })
      const result = await res.json()

      if (!result.success) {
        toast.error(result.message || 'Gagal menghapus produk')
        return
      }

      toast.success('Produk berhasil dihapus')
      setDeleteProduct(null)
      fetchData()
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(product.isActive ? 'Produk dinonaktifkan' : 'Produk diaktifkan')
        fetchData()
      }
    } catch {
      toast.error('Gagal mengubah status')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola semua produk toko</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Tambah Produk
        </Button>
      </div>

      {/* Filters and View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Cari produk, SKU..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1) }}
            className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle: Mode Stok vs Mode Data Penjualan */}
        <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setTableViewMode('STOCK')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
              tableViewMode === 'STOCK'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Tampilkan kolom stok & peringatan persediaan"
          >
            <Package className="h-3.5 w-3.5 text-amber-500" />
            <span>Mode Stok</span>
          </button>
          <button
            type="button"
            onClick={() => setTableViewMode('SALES')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
              tableViewMode === 'SALES'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Tampilkan kolom data penjualan (Hari ini, Bulan ini, Total)"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Mode Data Penjual</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Produk</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">Kategori</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-muted-foreground">Harga</th>

                {tableViewMode === 'STOCK' ? (
                  <>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Mode & Stok</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Status</th>
                  </>
                ) : (
                  <>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Terjual Hari Ini</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Terjual Bulan Ini</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Total Terjual</th>
                  </>
                )}

                <th className="text-center px-4 py-3 text-sm font-semibold text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3"><Skeleton className="h-10 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-16 mx-auto" /></td>
                    {tableViewMode === 'SALES' && (
                      <td className="px-4 py-3"><Skeleton className="h-6 w-16 mx-auto" /></td>
                    )}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20 mx-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={tableViewMode === 'STOCK' ? 6 : 7} className="px-4 py-16 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const category = typeof product.categoryId === 'object' ? product.categoryId : null
                  const shouldTrackStock = product.trackStock !== false && product.productMode !== 'SALES'
                  const isLowStock = shouldTrackStock && product.stock <= product.minimumStock

                  return (
                    <tr key={product._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <Image src={product.image} alt={product.name} width={40} height={40} className="object-cover w-full h-full" />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.sku && <span className="text-xs text-muted-foreground font-mono">SKU: {product.sku}</span>}
                              {!shouldTrackStock && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                                  Non-stok
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {category && (
                          <Badge variant="secondary">{category.name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(product.price)}</p>
                      </td>

                      {tableViewMode === 'STOCK' ? (
                        <>
                          <td className="px-4 py-3 text-center">
                            {shouldTrackStock ? (
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  'text-sm font-bold',
                                  product.stock === 0 ? 'text-destructive' : isLowStock ? 'text-orange-500' : 'text-foreground'
                                )}>
                                  {product.stock} pcs
                                </span>
                                {isLowStock && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-orange-500 mt-0.5 font-medium">
                                    <AlertTriangle className="h-3 w-3" />
                                    Stok Rendah (Min: {product.minimumStock})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Selalu Tersedia
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleToggleActive(product)} className="transition-colors" title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                              {product.isActive ? (
                                <ToggleRight className="h-6 w-6 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Mode Data Penjualan */}
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                              (product.soldToday || 0) > 0
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "text-muted-foreground bg-muted"
                            )}>
                              <Flame className={cn("h-3 w-3", (product.soldToday || 0) > 0 ? "text-amber-500" : "text-muted-foreground")} />
                              {product.soldToday || 0} pcs
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                              (product.soldThisMonth || 0) > 0
                                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                                : "text-muted-foreground bg-muted"
                            )}>
                              <Calendar className={cn("h-3 w-3", (product.soldThisMonth || 0) > 0 ? "text-indigo-500" : "text-muted-foreground")} />
                              {product.soldThisMonth || 0} pcs
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-foreground font-mono">
                                {product.soldTotal || 0} pcs
                              </span>
                              {(product.revenueThisMonth || 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  Bln ini: {formatCurrency(product.revenueThisMonth || 0)}
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Edit Produk"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteProduct(product)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Hapus Produk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">
              Halaman {page} dari {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Berikutnya
            </Button>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Nama Produk *"
                {...register('name')}
                error={errors.name?.message}
                placeholder="Nama produk"
              />
            </div>
            <div>
              <Input
                label="SKU"
                {...register('sku')}
                error={errors.sku?.message}
                placeholder="SKU-001"
              />
            </div>
            <div>
              <Input
                label="Barcode"
                {...register('barcode')}
                error={errors.barcode?.message}
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Kategori *
              </label>
              <select
                {...register('categoryId')}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Pilih Kategori</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-destructive mt-1">{errors.categoryId.message}</p>
              )}
            </div>
            <div>
              <Input
                label="Harga Jual (Rp) *"
                type="number"
                {...register('price', { valueAsNumber: true })}
                error={errors.price?.message}
                placeholder="15000"
              />
            </div>
            <div>
              <Input
                label="Harga Pokok (Rp)"
                type="number"
                {...register('costPrice', { valueAsNumber: true })}
                error={errors.costPrice?.message}
                placeholder="10000"
              />
            </div>
            {/* Mode Produk: Mode Stok vs Mode Data Penjual */}
            <div className="col-span-2 p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Mode Pengelolaan Produk
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className={cn(
                  "flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-xs",
                  watch('productMode') === 'STOCK'
                    ? "border-primary bg-primary/5 text-foreground font-semibold ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}>
                  <input
                    type="radio"
                    value="STOCK"
                    checked={watch('productMode') === 'STOCK'}
                    onChange={() => {
                      setValue('productMode', 'STOCK')
                      setValue('trackStock', true)
                    }}
                    className="mt-0.5 text-primary focus:ring-primary h-4 w-4"
                  />
                  <div>
                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                      <Package className="h-4 w-4 text-amber-500" />
                      Mode Stok (Kelola Fisik)
                    </span>
                    <p className="text-[11px] text-muted-foreground font-normal mt-1 leading-relaxed">
                      Barang memiliki jumlah stok fisik. Sistem memvalidasi ketersediaan dan mengurangi stok otomatis saat terjual.
                    </p>
                  </div>
                </label>

                <label className={cn(
                  "flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-xs",
                  watch('productMode') === 'SALES'
                    ? "border-primary bg-primary/5 text-foreground font-semibold ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}>
                  <input
                    type="radio"
                    value="SALES"
                    checked={watch('productMode') === 'SALES'}
                    onChange={() => {
                      setValue('productMode', 'SALES')
                      setValue('trackStock', false)
                    }}
                    className="mt-0.5 text-primary focus:ring-primary h-4 w-4"
                  />
                  <div>
                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Mode Data Penjual (Non-stok)
                    </span>
                    <p className="text-[11px] text-muted-foreground font-normal mt-1 leading-relaxed">
                      Cocok untuk makanan/minuman made-to-order atau jasa. Selalu tersedia & fokus pantau data terjual hari ini / bulan ini.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {watch('productMode') === 'STOCK' ? (
              <>
                <div>
                  <Input
                    label="Stok *"
                    type="number"
                    {...register('stock', { valueAsNumber: true })}
                    error={errors.stock?.message}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Input
                    label="Minimum Stok (Peringatan)"
                    type="number"
                    {...register('minimumStock', { valueAsNumber: true })}
                    error={errors.minimumStock?.message}
                    placeholder="5"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Mode Data Penjual Aktif:</strong> Produk ini selalu tersedia (tanpa batas stok fisik). Di kasir POS, Anda dapat memantau langsung statistik berapa pcs produk yang terjual hari ini dan bulan ini!
                </span>
              </div>
            )}
            <div className="col-span-2">
              <Input
                label="URL Gambar"
                {...register('image')}
                error={errors.image?.message}
                placeholder="https://example.com/image.jpg"
                leftIcon={<Upload className="h-4 w-4" />}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-foreground block mb-1.5">Deskripsi</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Deskripsi produk..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">Aktif</label>
              <button
                type="button"
                onClick={() => setValue('isActive', !watch('isActive'))}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  watch('isActive') ? 'bg-green-500' : 'bg-muted-foreground/30'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  watch('isActive') ? 'translate-x-6' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1" type="button" disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDelete}
        title="Hapus Produk?"
        description={`Apakah Anda yakin ingin menghapus "${deleteProduct?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus"
        isLoading={isDeleting}
        variant="destructive"
      />
    </div>
  )
}
