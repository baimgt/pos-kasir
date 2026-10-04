'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Category } from '@/types'
import { toast } from 'sonner'
import {
  Plus, Search, Edit2, Trash2, Tag, RefreshCw,
  FolderOpen, Layers, CheckCircle2, XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

interface CategoryFormData {
  name: string
  slug: string
  description: string
  image: string
  isActive: boolean
}

const initialForm: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  image: '',
  isActive: true,
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/categories')
      const json = await res.json()
      if (json.success) {
        setCategories(json.data || [])
      } else {
        toast.error(json.message || 'Gagal memuat kategori')
      }
    } catch {
      toast.error('Koneksi jaringan bermasalah')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const openCreateModal = () => {
    setEditingCategory(null)
    setFormData(initialForm)
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name,
      slug: cat.slug || '',
      description: cat.description || '',
      image: cat.image || '',
      isActive: cat.isActive !== false,
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: !editingCategory
        ? val
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
        : prev.slug,
    }))
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) {
      errors.name = 'Nama kategori wajib diisi'
    } else if (formData.name.length < 2) {
      errors.name = 'Nama minimal 2 karakter'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory._id}`
        : '/api/categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(
          editingCategory ? 'Kategori berhasil diperbarui' : 'Kategori baru ditambahkan'
        )
        setShowModal(false)
        fetchCategories()
      } else {
        toast.error(json.message || 'Gagal menyimpan kategori')
      }
    } catch {
      toast.error('Terjadi kesalahan sistem')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCategory) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/categories/${deleteCategory._id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Kategori berhasil dihapus')
        setDeleteCategory(null)
        fetchCategories()
      } else {
        toast.error(json.message || 'Gagal menghapus kategori')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleStatus = async (cat: Category) => {
    try {
      const res = await fetch(`/api/categories/${cat._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(
          `Kategori ${!cat.isActive ? 'diaktifkan' : 'dinonaktifkan'}`
        )
        fetchCategories()
      } else {
        toast.error(json.message || 'Gagal mengubah status')
      }
    } catch {
      toast.error('Gagal memperbarui status')
    }
  }

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch =
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      (cat.description &&
        cat.description.toLowerCase().includes(search.toLowerCase()))
    const matchesActive =
      filterActive === 'all'
        ? true
        : filterActive === 'active'
        ? cat.isActive
        : !cat.isActive
    return matchesSearch && matchesActive
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Kategori Menu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola kategori untuk mempermudah navigasi menu kasir dan pemesanan online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCategories}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button onClick={openCreateModal} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kategori
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari kategori..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                aria-label="Filter status aktif kategori"
                className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif Saja</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <FolderOpen className="h-6 w-6" />
            </div>
            <p className="font-semibold text-foreground">Tidak ada kategori</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Tidak ada kategori yang cocok dengan pencarian'
                : 'Mulai dengan membuat kategori pertama Anda'}
            </p>
            {!search && (
              <Button onClick={openCreateModal} size="sm" className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Kategori Sekarang
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => (
            <Card
              key={cat._id}
              className={cn(
                'group overflow-hidden hover:shadow-md transition-all border-border/80 flex flex-col justify-between',
                !cat.isActive && 'opacity-70 bg-muted/20'
              )}
            >
              <div>
                {/* Image / Header banner */}
                <div className="h-28 bg-gradient-to-br from-primary/10 via-primary/5 to-muted relative overflow-hidden flex items-center justify-center">
                  {cat.image ? (
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-primary/40">
                      <Tag className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={cat.isActive ? 'success' : 'secondary'}
                      className="text-xs backdrop-blur-sm"
                    >
                      {cat.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-1.5">
                  <h3 className="font-bold text-foreground text-base tracking-tight group-hover:text-primary transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    /{cat.slug}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {cat.description || 'Tidak ada deskripsi'}
                  </p>
                </div>
              </div>

              {/* Action footer */}
              <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(cat)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  {cat.isActive ? (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span>Nonaktifkan</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Aktifkan</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEditModal(cat)}
                    title="Edit Kategori"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => setDeleteCategory(cat)}
                    title="Hapus Kategori"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Nama Kategori <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Makanan Utama, Kopi, Dessert"
              value={formData.name}
              onChange={handleNameChange}
              error={formErrors.name}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Slug URL
            </label>
            <Input
              placeholder="makanan-utama"
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              helperText="Digunakan untuk URL filter otomatis"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Deskripsi
            </label>
            <textarea
              rows={3}
              placeholder="Deskripsi singkat mengenai jenis menu ini..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full text-sm rounded-lg border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <ImageUpload
              label="Gambar Banner Kategori (Opsional)"
              value={formData.image}
              onChange={(url) => setFormData((prev) => ({ ...prev, image: url }))}
              folder="categories"
              aspectRatio="banner"
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer">
              Kategori Aktif (Dapat dipilih di kasir & menu pelanggan)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : editingCategory ? 'Perbarui' : 'Simpan Kategori'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteCategory?.name}"? Produk yang terkait mungkin perlu dialihkan ke kategori lain.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
