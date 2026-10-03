'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  BarChart3, Calendar, Download, Printer, RefreshCw,
  TrendingUp, ShoppingBag, CreditCard, Banknote, QrCode,
  DollarSign, ArrowUpRight, Award, FileSpreadsheet
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, Badge, Skeleton } from '@/components/ui/Card'
import * as XLSX from 'xlsx'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { useReactToPrint } from 'react-to-print'
import { cn } from '@/lib/cn'

interface ReportData {
  summary: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    cashRevenue: number
    midtransRevenue: number
    totalCashOrders: number
    totalMidtransOrders: number
    totalQrOrders: number
    totalPosOrders: number
  }
  chartData: Array<{
    date: string
    revenue: number
    orders: number
  }>
  topProducts: Array<{
    productId: string
    productName: string
    totalQuantity: number
    totalRevenue: number
  }>
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>('7days')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const printReportRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printReportRef,
    documentTitle: `Laporan-Penjualan-${period}-${new Date().toISOString().split('T')[0]}`,
  })

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      if (period === 'custom' && startDate && endDate) {
        params.set('startDate', startDate)
        params.set('endDate', endDate)
      }

      const res = await fetch(`/api/reports/sales?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setReport(json.data)
      } else {
        toast.error(json.message || 'Gagal memuat laporan')
      }
    } catch {
      toast.error('Koneksi terganggu')
    } finally {
      setIsLoading(false)
    }
  }, [period, startDate, endDate])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const exportToExcel = () => {
    if (!report) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: Ringkasan
      const summaryRows = [
        ['METRIK', 'NILAI'],
        ['Total Pendapatan', report.summary.totalRevenue],
        ['Total Transaksi', report.summary.totalOrders],
        ['Rata-rata Transaksi', report.summary.averageOrderValue],
        ['Pendapatan Tunai (Cash)', report.summary.cashRevenue],
        ['Pendapatan Non-Tunai (Midtrans)', report.summary.midtransRevenue],
        ['Transaksi QR Meja', report.summary.totalQrOrders],
        ['Transaksi Kasir POS', report.summary.totalPosOrders],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

      // Sheet 2: Grafik Penjualan Harian
      const dailyRows = [
        ['Tanggal', 'Pendapatan (Rp)', 'Jumlah Transaksi'],
        ...report.chartData.map((d) => [d.date, d.revenue, d.orders]),
      ]
      const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows)
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Penjualan Harian')

      // Sheet 3: Produk Terlaris
      const topRows = [
        ['Nama Produk', 'Jumlah Terjual', 'Total Omzet (Rp)'],
        ...report.topProducts.map((p) => [
          p.productName,
          p.totalQuantity,
          p.totalRevenue,
        ]),
      ]
      const wsTop = XLSX.utils.aoa_to_sheet(topRows)
      XLSX.utils.book_append_sheet(wb, wsTop, 'Produk Terlaris')

      XLSX.writeFile(wb, `Laporan-POS-${period}-${Date.now()}.xlsx`)
      toast.success('Laporan berhasil diekspor ke Excel!')
    } catch (err) {
      console.error(err)
      toast.error('Gagal mengekspor laporan')
    }
  }

  const paymentPieData = report
    ? [
        { name: 'Tunai (Cash)', value: report.summary.cashRevenue },
        { name: 'Midtrans (QRIS/E-Wallet)', value: report.summary.midtransRevenue },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Laporan Analitik & Penjualan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analisis pendapatan, performa menu terlaris, dan perbandingan metode transaksi
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={isLoading || !report}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Export Excel
          </Button>

          <Button
            size="sm"
            onClick={() => handlePrint()}
            disabled={isLoading || !report}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Cetak Laporan
          </Button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Quick Period Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto scrollbar-none pb-1 lg:pb-0">
              {[
                { key: 'today', label: 'Hari Ini' },
                { key: 'yesterday', label: 'Kemarin' },
                { key: '7days', label: '7 Hari Terakhir' },
                { key: '30days', label: '30 Hari Terakhir' },
                { key: 'month', label: 'Bulan Ini' },
                { key: 'custom', label: 'Kustom Tanggal' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                    period === p.key
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs rounded-lg border border-border bg-background px-3 py-1.5 text-foreground"
                />
                <span className="text-xs text-muted-foreground">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs rounded-lg border border-border bg-background px-3 py-1.5 text-foreground"
                />
                <Button size="sm" onClick={fetchReport} className="text-xs h-8">
                  Terapkan
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Report Container (Printable) */}
      <div ref={printReportRef} className="space-y-6">
        {/* KPI Metrics */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : report ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total Pendapatan
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black mt-2 text-foreground">
                  {formatCurrency(report.summary.totalRevenue)}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span>AOV: {formatCurrency(report.summary.averageOrderValue)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Total Orders */}
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total Transaksi
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black mt-2 text-foreground">
                  {report.summary.totalOrders}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span>QR: {report.summary.totalQrOrders}</span>
                  <span>•</span>
                  <span>Kasir POS: {report.summary.totalPosOrders}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cash Payments */}
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pendapatan Tunai (Cash)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Banknote className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black mt-2 text-foreground">
                  {formatCurrency(report.summary.cashRevenue)}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span>{report.summary.totalCashOrders} transaksi tunai</span>
                </div>
              </CardContent>
            </Card>

            {/* Midtrans / Digital Payments */}
            <Card className="border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Midtrans (QRIS / Online)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black mt-2 text-foreground">
                  {formatCurrency(report.summary.midtransRevenue)}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span>{report.summary.totalMidtransOrders} transaksi digital</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Charts Row */}
        {report && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <Card className="lg:col-span-2">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-foreground">
                      Tren Penjualan ({period})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Grafik pendapatan harian sepanjang periode terpilih
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full pt-4">
                  {report.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={report.chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          stroke="#888888"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="#888888"
                          tickFormatter={(val) =>
                            val >= 1000000
                              ? `${(val / 1000000).toFixed(1)}M`
                              : val >= 1000
                              ? `${(val / 1000).toFixed(0)}k`
                              : `${val}`
                          }
                        />
                        <Tooltip
                          formatter={(value: unknown) => [
                            formatCurrency(Number(value) || 0),
                            'Pendapatan',
                          ]}
                          labelFormatter={(label) => `Tanggal: ${label}`}
                          contentStyle={{
                            backgroundColor: '#18181b',
                            borderColor: '#27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorRev)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                      Tidak ada data grafik untuk periode ini
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Pie */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Metode Pembayaran
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Komparasi omzet tunai vs pembayaran digital
                  </p>
                </div>

                <div className="h-56 w-full flex items-center justify-center">
                  {paymentPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {paymentPieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: unknown) => [
                            formatCurrency(Number(val) || 0),
                            'Omzet',
                          ]}
                          contentStyle={{
                            backgroundColor: '#18181b',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#fff',
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-muted-foreground text-xs text-center">
                      Belum ada data pembayaran
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      Tunai (Cash):
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(report.summary.cashRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                      Midtrans Digital:
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(report.summary.midtransRevenue)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Selling Products */}
        {report && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Produk Terlaris (Top Selling)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Menu makanan & minuman dengan volume penjualan tertinggi
                  </p>
                </div>
              </div>

              {report.topProducts.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Belum ada data produk terjual pada periode ini
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-2.5">Peringkat</th>
                        <th className="px-4 py-2.5">Nama Produk</th>
                        <th className="px-4 py-2.5 text-right">Qty Terjual</th>
                        <th className="px-4 py-2.5 text-right">Total Pendapatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-bold text-foreground">
                            {idx === 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs">
                                1
                              </span>
                            ) : idx === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400 text-white font-black text-xs">
                                2
                              </span>
                            ) : idx === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs">
                                3
                              </span>
                            ) : (
                              `#${idx + 1}`
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {p.productName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            {p.totalQuantity} porsi / item
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                            {formatCurrency(p.totalRevenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
