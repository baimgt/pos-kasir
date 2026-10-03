'use client'

import { useEffect, useState, useCallback } from 'react'
import { User } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Users, UserPlus, Search, Edit2, Trash2, Shield,
  RefreshCw, CheckCircle2, XCircle, KeyRound, Mail,
  Calendar, Lock, ChefHat
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

interface UserFormData {
  name: string
  email: string
  password?: string
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN'
  isActive: boolean
}

const initialForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'CASHIER',
  isActive: true,
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/users')
      const json = await res.json()
      if (json.success) {
        setUsers(json.data || [])
      } else {
        toast.error(json.message || 'Gagal mengambil data karyawan')
      }
    } catch {
      toast.error('Koneksi bermasalah')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData(initialForm)
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (u: User) => {
    setEditingUser(u)
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive !== false,
    })
    setFormErrors({})
    setShowModal(true)
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = 'Nama karyawan wajib diisi'
    if (!formData.email.trim()) {
      errors.email = 'Email wajib diisi'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Format email tidak valid'
    }

    if (!editingUser) {
      if (!formData.password) {
        errors.password = 'Password wajib diisi untuk pengguna baru'
      } else if (formData.password.length < 6) {
        errors.password = 'Password minimal 6 karakter'
      }
    } else if (formData.password && formData.password.length < 6) {
      errors.password = 'Password minimal 6 karakter'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        isActive: formData.isActive,
      }
      // Only include password if it was actually typed
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim()
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(
          editingUser ? 'Data karyawan berhasil diperbarui' : 'Karyawan baru berhasil ditambahkan'
        )
        setShowModal(false)
        fetchUsers()
      } else {
        // Show per-field validation errors from server
        if (json.errors) {
          const fieldErrs: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(json.errors)) {
            fieldErrs[field] = Array.isArray(msgs) ? (msgs as string[])[0] : String(msgs)
          }
          setFormErrors(fieldErrs)
        }
        toast.error(json.message || 'Gagal menyimpan data karyawan')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/users/${deleteUser._id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Karyawan berhasil dihapus')
        setDeleteUser(null)
        fetchUsers()
      } else {
        toast.error(json.message || 'Gagal menghapus karyawan')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Manajemen Karyawan & Hak Akses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola akun kasir dan administrator untuk operasional sistem kasir
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>

          <Button size="sm" onClick={openCreateModal}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Tambah Karyawan
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
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter role karyawan"
              className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Semua Peran (Role)</option>
              <option value="ADMIN">Administrator</option>
              <option value="CASHIER">Kasir</option>
              <option value="KITCHEN">Koki / Dapur</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <p className="font-semibold text-foreground">Tidak ada karyawan</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Tidak ada karyawan yang cocok dengan kriteria pencarian'
                : 'Mulai dengan menambahkan karyawan pertama'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const isAdmin = u.role === 'ADMIN'
            const isKitchen = u.role === 'KITCHEN'

            return (
              <Card
                key={u._id}
                className={cn(
                  'border-border hover:shadow-md transition-all flex flex-col justify-between overflow-hidden',
                  !u.isActive && 'opacity-60 bg-muted/20'
                )}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm',
                          isAdmin
                            ? 'bg-primary text-primary-foreground'
                            : isKitchen
                            ? 'bg-amber-500 text-white'
                            : 'bg-indigo-600 text-white'
                        )}
                      >
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          {u.name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={isAdmin ? 'default' : isKitchen ? 'warning' : 'secondary'}
                      className="text-xs flex items-center gap-1"
                    >
                      {isAdmin ? (
                        'Admin'
                      ) : isKitchen ? (
                        <>
                          <ChefHat className="h-3 w-3" />
                          Koki
                        </>
                      ) : (
                        'Kasir'
                      )}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>
                      <span>Status Akun:</span>
                      <p className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                        {u.isActive ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 text-rose-500" />
                            Nonaktif
                          </>
                        )}
                      </p>
                    </div>

                    <div>
                      <span>Terdaftar:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {formatDateTime(u.createdAt).split(' ')[0]}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-muted/20 border-t border-border flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openEditModal(u)}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => setDeleteUser(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Hapus
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Add / Edit User */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              error={formErrors.name}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Email Login <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              placeholder="kasir1@poskasir.com"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              error={formErrors.email}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              {editingUser
                ? 'Password Baru (Kosongkan jika tidak ingin diubah)'
                : 'Password * (minimal 6 karakter)'}
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              error={formErrors.password}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Peran (Hak Akses)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'CASHIER' }))}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  formData.role === 'CASHIER'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                )}
              >
                <div className="text-sm font-semibold">Kasir</div>
                <div className="text-[11px] font-normal opacity-80 mt-0.5">
                  Transaksi POS & Pesanan Meja
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'KITCHEN' }))}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  formData.role === 'KITCHEN'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-sm ring-1 ring-amber-500'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                )}
              >
                <div className="text-sm font-semibold flex items-center gap-1">
                  <ChefHat className="h-4 w-4" /> Koki (Dapur)
                </div>
                <div className="text-[11px] font-normal opacity-80 mt-0.5">
                  Pantau Pesanan Lunas & Ubah Jadi Siap
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'ADMIN' }))}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  formData.role === 'ADMIN'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                )}
              >
                <div className="text-sm font-semibold">Administrator</div>
                <div className="text-[11px] font-normal opacity-80 mt-0.5">
                  Akses penuh ke semua modul sistem
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveUser"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label
              htmlFor="isActiveUser"
              className="text-xs font-medium text-foreground cursor-pointer"
            >
              Akun Aktif (Dapat masuk ke dalam aplikasi POS)
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
              {isSubmitting ? 'Menyimpan...' : editingUser ? 'Perbarui' : 'Simpan Karyawan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Hapus Karyawan"
        message={`Apakah Anda yakin ingin menghapus akun karyawan "${deleteUser?.name}" (${deleteUser?.email})?`}
        confirmText="Hapus Akun"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
