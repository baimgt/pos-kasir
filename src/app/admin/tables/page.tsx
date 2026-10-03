'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Table as TableType } from '@/types'
import { toast } from 'sonner'
import {
  Plus, Search, Edit2, Trash2, QrCode, RefreshCw,
  Printer, ExternalLink, Download, CheckCircle2, XCircle,
  Table2, UtensilsCrossed, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { useReactToPrint } from 'react-to-print'
import { cn } from '@/lib/cn'

interface TableFormData {
  tableNumber: string
  name: string
  isActive: boolean
}

const initialForm: TableFormData = {
  tableNumber: '',
  name: '',
  isActive: true,
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingTable, setEditingTable] = useState<TableType | null>(null)
  const [formData, setFormData] = useState<TableFormData>(initialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteTable, setDeleteTable] = useState<TableType | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // QR preview & print modal
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableType | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `QR-Meja-${selectedTableForQr?.tableNumber || 'Standee'}`,
  })

  const fetchTables = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/tables')
      const json = await res.json()
      if (json.success) {
        setTables(json.data || [])
      } else {
        toast.error(json.message || 'Gagal memuat data meja')
      }
    } catch {
      toast.error('Koneksi server terganggu')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  const openCreateModal = () => {
    setEditingTable(null)
    setFormData(initialForm)
    setFormErrors({})
    setShowModal(true)
  }

  const openEditModal = (t: TableType) => {
    setEditingTable(t)
    setFormData({
      tableNumber: t.tableNumber,
      name: t.name,
      isActive: t.isActive !== false,
    })
    setFormErrors({})
    setShowModal(true)
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!formData.tableNumber.trim()) {
      errors.tableNumber = 'Nomor meja wajib diisi'
    }
    if (!formData.name.trim()) {
      errors.name = 'Nama / label meja wajib diisi'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const url = editingTable
        ? `/api/tables/${editingTable._id}`
        : '/api/tables'
      const method = editingTable ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(
          editingTable ? 'Data meja berhasil diperbarui' : 'Meja baru dan QR Code berhasil dibuat'
        )
        setShowModal(false)
        fetchTables()
      } else {
        toast.error(json.message || 'Gagal menyimpan meja')
      }
    } catch {
      toast.error('Terjadi kesalahan sistem')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTable) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tables/${deleteTable._id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Meja berhasil dihapus')
        setDeleteTable(null)
        fetchTables()
      } else {
        toast.error(json.message || 'Gagal menghapus meja')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRegenerateQr = async (tableId: string) => {
    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/qr`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('QR Code meja berhasil diperbarui')
        fetchTables()
        if (selectedTableForQr && selectedTableForQr._id === tableId) {
          setSelectedTableForQr(json.data)
        }
      } else {
        toast.error(json.message || 'Gagal memperbarui QR')
      }
    } catch {
      toast.error('Terjadi kesalahan saat regenerate QR')
    } finally {
      setIsRegenerating(false)
    }
  }

  const downloadQrCode = (table: TableType) => {
    if (!table.qrCode) {
      toast.error('QR Code belum digenerate')
      return
    }
    const link = document.createElement('a')
    link.href = table.qrCode
    link.download = `QR-Meja-${table.tableNumber}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`QR Meja ${table.tableNumber} berhasil diunduh`)
  }

  const filteredTables = tables.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tableNumber.toLowerCase().includes(search.toLowerCase())
    const matchesActive =
      filterActive === 'all'
        ? true
        : filterActive === 'active'
        ? t.isActive
        : !t.isActive
    return matchesSearch && matchesActive
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Table2 className="h-7 w-7 text-primary" />
            Manajemen Meja & QR Code
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola meja restoran dan QR Code unik untuk pemesanan mandiri oleh pelanggan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTables}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button onClick={openCreateModal} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Meja Baru
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
                placeholder="Cari nomor meja atau nama meja..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                aria-label="Filter status aktif meja"
                className="text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Semua Meja ({tables.length})</option>
                <option value="active">
                  Aktif Saja ({tables.filter((t) => t.isActive).length})
                </option>
                <option value="inactive">
                  Nonaktif ({tables.filter((t) => !t.isActive).length})
                </option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Table2 className="h-6 w-6" />
            </div>
            <p className="font-semibold text-foreground">Belum ada meja</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Tidak ada meja yang cocok dengan filter pencarian'
                : 'Tambahkan meja restoran Anda untuk menghasilkan QR Code pemesanan'}
            </p>
            {!search && (
              <Button onClick={openCreateModal} size="sm" className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Meja Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredTables.map((table) => (
            <Card
              key={table._id}
              className={cn(
                'group overflow-hidden transition-all duration-200 border-border hover:shadow-lg flex flex-col justify-between',
                !table.isActive && 'opacity-65 bg-muted/20'
              )}
            >
              <div>
                {/* Header Card */}
                <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                      {table.tableNumber}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {table.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Meja No. {table.tableNumber}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={table.isActive ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {table.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>

                {/* QR Display */}
                <div className="p-4 flex flex-col items-center justify-center bg-card">
                  <div
                    onClick={() => setSelectedTableForQr(table)}
                    className="p-3 bg-white rounded-xl border border-border/80 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                    title="Klik untuk cetak atau lihat detail QR"
                  >
                    {table.qrCode ? (
                      <div className="relative w-32 h-32">
                        <Image
                          src={table.qrCode}
                          alt={`QR Code Meja ${table.tableNumber}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <QrCode className="h-8 w-8" />
                        <span className="text-[10px]">QR Belum Dibuat</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Klik QR untuk cetak kartu meja
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 border-t border-border bg-muted/10 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-full justify-center"
                    onClick={() => setSelectedTableForQr(table)}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Cetak
                  </Button>
                  <Link
                    href={`/order/${table.qrToken}`}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Buka
                  </Link>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <button
                    onClick={() => downloadQrCode(table)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    title="Download file QR PNG"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh PNG
                  </button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEditModal(table)}
                      title="Edit Meja"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setDeleteTable(table)}
                      title="Hapus Meja"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTable ? 'Edit Meja' : 'Tambah Meja Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Nomor Meja <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: 01, 02, T-05, VIP-1"
              value={formData.tableNumber}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tableNumber: e.target.value }))
              }
              error={formErrors.tableNumber}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Nama / Deskripsi Meja <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Meja Depan Jendela, Meja Indoor 1, Meja Outdoor VIP"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              error={formErrors.name}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isTableActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label
              htmlFor="isTableActive"
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              Meja Aktif (Pelanggan dapat melakukan pemesanan via QR)
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
              {isSubmitting ? 'Menyimpan...' : editingTable ? 'Perbarui' : 'Buat Meja & QR'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Code Standee Print Modal */}
      <Modal
        isOpen={!!selectedTableForQr}
        onClose={() => setSelectedTableForQr(null)}
        title={`Kartu Meja & QR Code - Meja ${selectedTableForQr?.tableNumber || ''}`}
        size="md"
      >
        {selectedTableForQr && (
          <div className="space-y-4">
            {/* Printable Area */}
            <div className="p-4 bg-muted/40 rounded-xl flex justify-center">
              <div
                ref={printRef}
                className="w-72 bg-white text-zinc-900 p-6 rounded-2xl shadow-md border-2 border-dashed border-zinc-300 text-center flex flex-col items-center"
                style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
              >
                <div className="flex items-center gap-2 text-primary font-bold text-lg mb-1">
                  <UtensilsCrossed className="h-5 w-5 text-indigo-600" />
                  <span className="text-zinc-900 tracking-tight">Restoran Kami</span>
                </div>
                <p className="text-xs text-zinc-500 mb-3">Scan & Pesan dari Smartphone</p>

                {/* Table Number Pill */}
                <div className="bg-indigo-600 text-white font-extrabold text-2xl px-6 py-2 rounded-xl mb-4 shadow-sm">
                  MEJA {selectedTableForQr.tableNumber}
                </div>

                {/* QR Code Image */}
                <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-sm mb-3">
                  {selectedTableForQr.qrCode ? (
                    <div className="relative w-44 h-44">
                      <Image
                        src={selectedTableForQr.qrCode}
                        alt={`QR Meja ${selectedTableForQr.tableNumber}`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-zinc-400">
                      QR Tidak Tersedia
                    </div>
                  )}
                </div>

                {/* Instruction */}
                <div className="text-[11px] text-zinc-600 space-y-1">
                  <p className="font-semibold text-zinc-800">Cara Memesan:</p>
                  <p>1. Buka kamera ponsel Anda</p>
                  <p>2. Arahkan ke kode QR di atas</p>
                  <p>3. Pilih menu dan lakukan pembayaran</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200 w-full text-[10px] text-zinc-400">
                  {selectedTableForQr.name}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRegenerateQr(selectedTableForQr._id)}
                disabled={isRegenerating}
                className="w-full sm:w-auto"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5 mr-1.5', isRegenerating && 'animate-spin')}
                />
                Buat Ulang Token QR
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQrCode(selectedTableForQr)}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Unduh PNG
                </Button>
                <Button size="sm" onClick={() => handlePrint()}>
                  <Printer className="h-4 w-4 mr-1.5" />
                  Cetak Kartu
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTable}
        onClose={() => setDeleteTable(null)}
        onConfirm={handleDelete}
        title="Hapus Meja"
        message={`Apakah Anda yakin ingin menghapus meja "${deleteTable?.name}" (Meja ${deleteTable?.tableNumber})? Pelanggan tidak akan bisa lagi mengakses menu dari QR code meja ini.`}
        confirmText="Hapus Meja"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
