'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings } from '@/types'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon, Save, Store, Receipt,
  Percent, CreditCard, QrCode, Phone, Mail, MapPin,
  RefreshCw, CheckCircle2, ShieldAlert,
  Eye, EyeOff, Zap, ExternalLink, Copy, Check, KeyRound, ShieldCheck,
  Package, TrendingUp, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({
    storeName: 'POS Kasir Modern',
    storeAddress: 'Jl. Malioboro No. 123, Yogyakarta',
    storePhone: '081234567890',
    storeEmail: 'admin@poskasir.com',
    receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.',
    taxEnabled: true,
    taxPercentage: 11,
    discountEnabled: true,
    currency: 'IDR',
    currencySymbol: 'Rp',
    cashPaymentEnabled: true,
    midtransEnabled: true,
    midtransServerKey: '',
    midtransClientKey: '',
    midtransIsProduction: false,
    qrOrderingEnabled: true,
    qrAllowCashPayment: true,
    qrAllowMidtransPayment: true,
    defaultProductViewMode: 'STOCK',
    smtpEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: '',
    smtpFromEmail: '',
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showServerKey, setShowServerKey] = useState(false)
  const [showClientKey, setShowClientKey] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [isTestingEmail, setIsTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTestingMidtrans, setIsTestingMidtrans] = useState(false)
  const [midtransTestResult, setMidtransTestResult] = useState<{
    success: boolean
    message: string
    suggestSwitch?: 'production' | 'sandbox'
  } | null>(null)
  const [hasCopiedWebhook, setHasCopiedWebhook] = useState(false)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (json.success && json.data) {
        // MERGE fetched data into state — don't replace entirely
        // so that initial state defaults (like defaultProductViewMode) are kept
        // if the old DB document doesn't have that field yet
        setSettings(prev => ({ ...prev, ...json.data }))
      }
    } catch {
      toast.error('Gagal mengambil pengaturan')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const doSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()

      if (json.success) {
        toast.success('Pengaturan toko berhasil diperbarui!')
        // State sudah benar (user yang ubah) — tidak perlu update dari response API
        // Mengupdate dari response bisa menyebabkan revert jika field tidak lengkap
      } else {
        toast.error(json.message || 'Gagal menyimpan pengaturan')
        // Jika gagal, re-fetch dari server untuk sinkronisasi
        fetchSettings()
      }
    } catch {
      toast.error('Koneksi terputus')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    doSave()
  }

  const handleTestMidtransConnection = async () => {
    if (!settings.midtransServerKey) {
      toast.error('Masukkan Server Key terlebih dahulu untuk melakukan pengujian.')
      return
    }

    setIsTestingMidtrans(true)
    setMidtransTestResult(null)
    try {
      const res = await fetch('/api/settings/midtrans-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverKey: settings.midtransServerKey,
          isProduction: settings.midtransIsProduction,
        }),
      })
      const json = await res.json()
      setMidtransTestResult({
        success: json.success,
        message: json.message,
        suggestSwitch: json.suggestSwitch,
      })
      if (json.success) {
        toast.success(json.message)
      } else {
        toast.error(json.message)
      }
    } catch {
      setMidtransTestResult({
        success: false,
        message: 'Koneksi ke server gagal. Pastikan jaringan internet aktif.',
      })
      toast.error('Gagal menghubungi server')
    } finally {
      setIsTestingMidtrans(false)
    }
  }

  const handleTestEmail = async () => {
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      toast.error('Host SMTP, Akun Email, dan Password wajib diisi untuk tes email.')
      return
    }

    setIsTestingEmail(true)
    setEmailTestResult(null)
    try {
      const res = await fetch('/api/settings/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass,
          smtpFromName: settings.smtpFromName,
          smtpFromEmail: settings.smtpFromEmail,
        }),
      })
      const json = await res.json()
      setEmailTestResult({
        success: json.success,
        message: json.message,
      })
      if (json.success) {
        toast.success(json.message)
      } else {
        toast.error(json.message)
      }
    } catch {
      setEmailTestResult({
        success: false,
        message: 'Koneksi ke server gagal saat menguji email. Pastikan jaringan aktif.',
      })
      toast.error('Gagal menghubungi server')
    } finally {
      setIsTestingEmail(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SettingsIcon className="h-7 w-7 text-primary" />
            Pengaturan Toko & Sistem
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Konfigurasi profil restoran, informasi struk, perpajakan, dan gateway pembayaran
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            disabled={isLoading || isSaving}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')}
            />
            Reset
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => doSave()}
            disabled={isLoading || isSaving}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Profil Restoran / Toko */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border text-foreground font-bold text-base">
              <Store className="h-5 w-5 text-primary" />
              <span>Identitas & Profil Usaha</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Nama Toko / Restoran
                </label>
                <Input
                  value={settings.storeName || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, storeName: e.target.value })
                  }
                  placeholder="Restoran Rasa Nusantara"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <Input
                  value={settings.storePhone || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, storePhone: e.target.value })
                  }
                  placeholder="0812-3456-7890"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Email Usaha
                </label>
                <Input
                  type="email"
                  value={settings.storeEmail || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, storeEmail: e.target.value })
                  }
                  placeholder="halo@resto.com"
                />
              </div>

              <div className="md:col-span-2">
                <ImageUpload
                  label="Logo Toko / Restoran (Opsional)"
                  value={settings.storeLogo || ''}
                  onChange={(url) => setSettings({ ...settings, storeLogo: url })}
                  folder="logos"
                  aspectRatio="auto"
                  placeholder="https://.../logo.png"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={settings.storeAddress || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, storeAddress: e.target.value })
                  }
                  placeholder="Jl. Malioboro No. 123, Yogyakarta"
                  className="w-full text-xs rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Struk & Pajak (Tax / PPN) */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border text-foreground font-bold text-base">
              <Receipt className="h-5 w-5 text-indigo-500" />
              <span>Format Struk & Perpajakan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Pajak Pertambahan Nilai (PPN / PB1)
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="checkbox"
                    id="taxEnabled"
                    checked={settings.taxEnabled ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, taxEnabled: e.target.checked })
                    }
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="taxEnabled" className="text-xs font-medium text-foreground cursor-pointer">
                    Aktifkan Perhitungan Pajak
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Tarif Pajak (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.taxPercentage ?? 11}
                  disabled={!settings.taxEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      taxPercentage: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Catatan Kaki Struk (Receipt Footer Note)
                </label>
                <textarea
                  rows={3}
                  value={settings.receiptFooter || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, receiptFooter: e.target.value })
                  }
                  placeholder="Terima kasih atas kunjungan Anda!\nFollow Instagram kami @restoran"
                  className="w-full text-xs font-mono rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[11px] text-muted-foreground">
                  Teks ini akan tercetak di bagian paling bawah struk kasir thermal 58mm
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section: Mode Operasional & Tampilan Produk Kasir */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-foreground font-bold text-base">
                <Package className="h-5 w-5 text-amber-500" />
                <span>Mode Tampilan & Operasional Produk Kasir</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                Fitur Baru
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Tentukan orientasi tampilan produk default di halaman kasir (POS). Anda juga dapat mengatur mode per-produk di menu &quot;Kelola Produk&quot; (misal: menu F&B / Made-to-Order yang tidak memakai stok fisik tetapi menampilkan data penjualan hari ini dan bulan ini).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Option 1: Mode Stok */}
              <div
                onClick={() => setSettings({ ...settings, defaultProductViewMode: 'STOCK' })}
                className={cn(
                  "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 relative flex flex-col justify-between space-y-3",
                  (settings.defaultProductViewMode ?? 'STOCK') === 'STOCK'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card"
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit">
                      <Package className="h-5 w-5" />
                    </div>
                    <input
                      type="radio"
                      name="defaultProductViewMode"
                      value="STOCK"
                      checked={(settings.defaultProductViewMode ?? 'STOCK') === 'STOCK'}
                      onChange={() => setSettings({ ...settings, defaultProductViewMode: 'STOCK' })}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Mode Stok Fisik</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Fokus pada sisa stok gudang, peringatan stok menipis, dan pencegahan checkout jika stok habis. Sangat pas untuk produk ritel, kemasan, atau barang terbatas.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  Label: &quot;Sisa 15 pcs&quot; / &quot;Stok Habis&quot;
                </div>
              </div>

              {/* Option 2: Mode Data Penjual */}
              <div
                onClick={() => setSettings({ ...settings, defaultProductViewMode: 'SALES' })}
                className={cn(
                  "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 relative flex flex-col justify-between space-y-3",
                  settings.defaultProductViewMode === 'SALES'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card"
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <input
                      type="radio"
                      name="defaultProductViewMode"
                      value="SALES"
                      checked={settings.defaultProductViewMode === 'SALES'}
                      onChange={() => setSettings({ ...settings, defaultProductViewMode: 'SALES' })}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Mode Data Penjual</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Fokus pada performa penjualan harian &amp; bulanan tanpa membatasi stok fisik. Sangat cocok untuk cafe, restoran, minuman racikan, dan makanan cepat saji.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Label: &quot;🔥 12 Terjual Hari Ini&quot; / &quot;📅 85 Bulan Ini&quot;
                </div>
              </div>

              {/* Option 3: Mode Kombinasi */}
              <div
                onClick={() => setSettings({ ...settings, defaultProductViewMode: 'HYBRID' })}
                className={cn(
                  "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 relative flex flex-col justify-between space-y-3",
                  settings.defaultProductViewMode === 'HYBRID'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card"
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 w-fit">
                      <Layers className="h-5 w-5" />
                    </div>
                    <input
                      type="radio"
                      name="defaultProductViewMode"
                      value="HYBRID"
                      checked={settings.defaultProductViewMode === 'HYBRID'}
                      onChange={() => setSettings({ ...settings, defaultProductViewMode: 'HYBRID' })}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Mode Kombinasi</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Menampilkan data sisa stok fisik sekaligus data penjualan bulan ini secara bersamaan di kartu produk kasir untuk visibilitas maksimal.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                  Label: Sisa Stok + 📅 Terjual Bulan Ini
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-semibold text-foreground">💡 Tips:</span>
              <span>Kasir juga dapat beralih mode secara instan kapan saja di halaman POS melalui tombol Switcher di pojok kanan atas.</span>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Fitur QR Ordering & Payment Channels */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border text-foreground font-bold text-base">
              <QrCode className="h-5 w-5 text-emerald-500" />
              <span>Pemesanan Mandiri QR Meja & Pembayaran</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-border space-y-2 bg-muted/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Sistem Pemesanan QR Meja
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.qrOrderingEnabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        qrOrderingEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Izinkan pelanggan membuka halaman pemesanan langsung dari scan QR di meja
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border space-y-2 bg-muted/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Bayar Tunai di Kasir (Untuk QR Order)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.qrAllowCashPayment ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        qrAllowCashPayment: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pelanggan memesan via QR dan membayar langsung secara tunai ke kasir
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border space-y-2 bg-muted/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Payment Gateway Midtrans (QRIS, E-Wallet)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.midtransEnabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        midtransEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mendukung QRIS instan, Gopay, ShopeePay, dan Transfer Bank via Midtrans Snap
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border space-y-2 bg-muted/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Midtrans Online untuk Pemesanan QR
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.qrAllowMidtransPayment ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        qrAllowMidtransPayment: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pelanggan dapat langsung membayar dari meja menggunakan QRIS / e-wallet
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Konfigurasi Kredensial Midtrans */}
        <Card className="border-indigo-500/30">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    Kredensial API Midtrans
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      settings.midtransIsProduction
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    )}>
                      {settings.midtransIsProduction ? 'Production / Live' : 'Sandbox (Testing)'}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Atur Server Key dan Client Key Midtrans langsung dari aplikasi tanpa perlu edit file .env
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestMidtransConnection}
                disabled={isTestingMidtrans || !settings.midtransServerKey}
                className="self-start sm:self-auto text-xs"
              >
                {isTestingMidtrans ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Memeriksa Kredensial...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                    Tes Koneksi Midtrans
                  </>
                )}
              </Button>
            </div>

            {/* Test Result Alert if any */}
            {midtransTestResult && (
              <div className={cn(
                "p-3.5 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border transition-all",
                midtransTestResult.success
                  ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-800 border-rose-500/20 dark:text-rose-300"
              )}>
                <div className="flex items-start gap-2.5 flex-1">
                  {midtransTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <span className="leading-relaxed">{midtransTestResult.message}</span>
                </div>
                {midtransTestResult.suggestSwitch && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const isProd = midtransTestResult.suggestSwitch === 'production'
                      setSettings({ ...settings, midtransIsProduction: isProd })
                      setMidtransTestResult({
                        success: true,
                        message: `Mode berhasil dialihkan ke ${isProd ? 'PRODUCTION (Live)' : 'SANDBOX (Uji Coba)'}. Silakan klik tombol "Simpan Semua Pengaturan" di paling bawah.`,
                      })
                      toast.success(`Mode dialihkan ke ${isProd ? 'Production' : 'Sandbox'}`)
                    }}
                    className={cn(
                      "text-xs shrink-0 self-end sm:self-auto shadow-sm",
                      midtransTestResult.suggestSwitch === 'production'
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                    )}
                  >
                    Beralih ke Mode {midtransTestResult.suggestSwitch === 'production' ? 'Production (Live)' : 'Sandbox'}
                  </Button>
                )}
              </div>
            )}

            {/* Environment Selection */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Environment / Mode Operasi Midtrans
              </label>
              <div className="flex flex-wrap items-center gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="radio"
                    name="midtransEnv"
                    checked={!settings.midtransIsProduction}
                    onChange={() => setSettings({ ...settings, midtransIsProduction: false })}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                    Mode Sandbox (Uji Coba / Testing)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="radio"
                    name="midtransEnv"
                    checked={!!settings.midtransIsProduction}
                    onChange={() => setSettings({ ...settings, midtransIsProduction: true })}
                    className="text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
                    Mode Production (Live Uang Sungguhan)
                  </span>
                </label>
              </div>

              {/* Smart Key Format Hint */}
              {settings.midtransServerKey && (
                (() => {
                  const looksLikeProd = !settings.midtransServerKey.startsWith('SB-') && (settings.midtransServerKey.startsWith('Mid-server-') || settings.midtransServerKey.length > 20)
                  const looksLikeSandbox = settings.midtransServerKey.startsWith('SB-')

                  if (looksLikeProd && !settings.midtransIsProduction) {
                    return (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>
                          💡 <strong>Format Terdeteksi:</strong> Server Key Anda adalah format <strong>Production</strong> (tanpa &quot;SB-&quot;). Jika Anda memakai akun live Midtrans, ubah ke <strong>Mode Production</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings({ ...settings, midtransIsProduction: true })
                            toast.info('Beralih ke Mode Production')
                          }}
                          className="font-semibold underline hover:no-underline shrink-0 text-amber-800 dark:text-amber-300 self-start sm:self-auto"
                        >
                          Klik: Ubah ke Production
                        </button>
                      </div>
                    )
                  }

                  if (looksLikeSandbox && settings.midtransIsProduction) {
                    return (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>
                          💡 <strong>Format Terdeteksi:</strong> Server Key Anda berawalan &quot;SB-&quot; (format <strong>Sandbox</strong>), tetapi mode saat ini adalah <strong>Production</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings({ ...settings, midtransIsProduction: false })
                            toast.info('Beralih ke Mode Sandbox')
                          }}
                          className="font-semibold underline hover:no-underline shrink-0 text-amber-800 dark:text-amber-300 self-start sm:self-auto"
                        >
                          Klik: Ubah ke Sandbox
                        </button>
                      </div>
                    )
                  }
                  return null
                })()
              )}

              <p className="text-[11px] text-muted-foreground mt-1">
                {settings.midtransIsProduction
                  ? '⚠️ Mode Production aktif: Transaksi akan memotong saldo / pembayaran uang riil.'
                  : 'Mode Sandbox aktif: Gunakan kartu tes & QR simulator Midtrans untuk uji coba transaksi.'}
              </p>
            </div>

            {/* Keys Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                    Midtrans Server Key
                  </label>
                  {settings.midtransServerKey && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      settings.midtransServerKey.startsWith('SB-')
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    )}>
                      {settings.midtransServerKey.startsWith('SB-') ? 'Format: Sandbox' : 'Format: Production'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showServerKey ? 'text' : 'password'}
                    value={settings.midtransServerKey || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, midtransServerKey: e.target.value.trim() })
                    }
                    placeholder="SB-Mid-server-xxxxxxxxxxxx"
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowServerKey(!showServerKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showServerKey ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showServerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Server Key bersifat rahasia di backend untuk membuat Snap token & memverifikasi notifikasi.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                    Midtrans Client Key
                  </label>
                  {settings.midtransClientKey && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      settings.midtransClientKey.startsWith('SB-')
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    )}>
                      {settings.midtransClientKey.startsWith('SB-') ? 'Format: Sandbox' : 'Format: Production'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showClientKey ? 'text' : 'password'}
                    value={settings.midtransClientKey || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, midtransClientKey: e.target.value.trim() })
                    }
                    placeholder="SB-Mid-client-xxxxxxxxxxxx"
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientKey(!showClientKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showClientKey ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showClientKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Client Key digunakan frontend browser untuk menginisiasi popup Midtrans Snap.
                </p>
              </div>
            </div>

            {/* Webhook & Notification URL Info */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  Konfigurasi Webhook / Notification URL Midtrans
                </span>
                <a
                  href={settings.midtransIsProduction ? "https://dashboard.midtrans.com" : "https://dashboard.sandbox.midtrans.com"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Buka Midtrans Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Salin URL webhook di bawah ini lalu tempel ke menu <strong>Settings &gt; Configuration &gt; Payment Notification URL</strong> di dashboard Midtrans agar status pembayaran otomatis berubah menjadi lunas:
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-[11px] bg-background p-2 rounded-lg border border-border select-all overflow-x-auto text-foreground">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/payments/midtrans/webhook` : 'https://domain-anda.com/api/payments/midtrans/webhook'}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/api/payments/midtrans/webhook`
                    navigator.clipboard.writeText(url)
                    setHasCopiedWebhook(true)
                    toast.success('URL webhook berhasil disalin!')
                    setTimeout(() => setHasCopiedWebhook(false), 2500)
                  }}
                  className="text-xs shrink-0"
                >
                  {hasCopiedWebhook ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                      Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Salin URL
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Konfigurasi Email / SMTP */}
        <Card className="border-emerald-500/30">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    Pengiriman Email Struk Digital
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      settings.smtpEnabled
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    )}>
                      {settings.smtpEnabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Kirim struk pembayaran otomatis ke email pelanggan setelah transaksi berhasil
                  </p>
                </div>
              </div>

              {/* Test Email Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestEmail}
                disabled={isTestingEmail || !settings.smtpEnabled || !settings.smtpHost || !settings.smtpUser}
                className="self-start sm:self-auto text-xs"
              >
                {isTestingEmail ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    Tes Kirim Email
                  </>
                )}
              </Button>
            </div>

            {/* Test Result */}
            {emailTestResult && (
              <div className={cn(
                "p-3.5 rounded-xl text-xs flex items-start gap-2.5 border",
                emailTestResult.success
                  ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-800 border-rose-500/20 dark:text-rose-300"
              )}>
                {emailTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span className="leading-relaxed">{emailTestResult.message}</span>
              </div>
            )}

            {/* Enable Toggle */}
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Aktifkan Fitur Email Struk</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saat aktif, pelanggan yang mengisi email akan menerima struk digital otomatis
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="smtpEnabled"
                  checked={settings.smtpEnabled ?? false}
                  onChange={(e) => setSettings({ ...settings, smtpEnabled: e.target.checked })}
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>
            </div>

            {/* SMTP Fields */}
            <div className={cn("space-y-4 transition-opacity", !settings.smtpEnabled && "opacity-40 pointer-events-none")}>

              {/* Host & Port */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    SMTP Host / Server
                  </label>
                  <Input
                    value={settings.smtpHost || ''}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value.trim() })}
                    placeholder="smtp.gmail.com"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Port
                  </label>
                  <Input
                    type="number"
                    value={settings.smtpPort ?? 587}
                    onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                    placeholder="587"
                    min={1}
                    max={65535}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Security */}
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="radio"
                    name="smtpSecurity"
                    checked={!settings.smtpSecure}
                    onChange={() => setSettings({ ...settings, smtpSecure: false, smtpPort: 587 })}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>TLS / STARTTLS (Port 587) — direkomendasikan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <input
                    type="radio"
                    name="smtpSecurity"
                    checked={!!settings.smtpSecure}
                    onChange={() => setSettings({ ...settings, smtpSecure: true, smtpPort: 465 })}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>SSL (Port 465)</span>
                </label>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Akun Email (Username)
                  </label>
                  <Input
                    type="email"
                    value={settings.smtpUser || ''}
                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value.trim() })}
                    placeholder="akunanda@gmail.com"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Password / App Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={settings.smtpPass || ''}
                      onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* From Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Nama Pengirim
                  </label>
                  <Input
                    value={settings.smtpFromName || ''}
                    onChange={(e) => setSettings({ ...settings, smtpFromName: e.target.value })}
                    placeholder={settings.storeName || 'Nama Toko'}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Nama yang muncul di kotak masuk pelanggan, misal: &quot;Warung Pak Budi&quot;
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Email Pengirim (From)
                  </label>
                  <Input
                    type="email"
                    value={settings.smtpFromEmail || ''}
                    onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value.trim() })}
                    placeholder={settings.smtpUser || 'noreply@toko.com'}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Kosongkan untuk menggunakan akun email di atas
                  </p>
                </div>
              </div>

              {/* Gmail tip */}
              <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-900/50 space-y-1.5">
                <p className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  💡 Cara Pakai Gmail
                </p>
                <ol className="text-[11px] text-sky-800 dark:text-sky-300 space-y-1 list-decimal list-inside">
                  <li>Aktifkan verifikasi 2 langkah di <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline">myaccount.google.com</a></li>
                  <li>Buat <strong>App Password</strong> di <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">myaccount.google.com/apppasswords</a></li>
                  <li>Isi host: <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded">smtp.gmail.com</code>, port: <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded">587</code></li>
                  <li>Username: alamat Gmail Anda, Password: App Password (16 karakter)</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" disabled={isSaving}>
            <Save className="h-5 w-5 mr-2" />
            {isSaving ? 'Menyimpan Pengaturan...' : 'Simpan Semua Pengaturan'}
          </Button>
        </div>
      </form>
    </div>
  )
}
