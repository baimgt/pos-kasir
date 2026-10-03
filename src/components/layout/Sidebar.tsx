'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  ShoppingCart,
  QrCode,
  Package,
  Tag,
  Layers,
  Receipt,
  BarChart3,
  Users,
  Table2,
  Settings,
  LogOut,
  Store,
  ChevronLeft,
  Menu,
  ChefHat,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  roles?: ('ADMIN' | 'CASHIER' | 'KITCHEN')[]
  children?: NavItem[]
}

const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
  { href: '/cashier/pos', icon: <ShoppingCart className="h-5 w-5" />, label: 'Kasir / POS' },
  { href: '/kitchen', icon: <ChefHat className="h-5 w-5" />, label: 'Dapur / KDS' },
  { href: '/admin/qr-orders', icon: <QrCode className="h-5 w-5" />, label: 'Pesanan QR' },
  { href: '/admin/products', icon: <Package className="h-5 w-5" />, label: 'Produk' },
  { href: '/admin/categories', icon: <Tag className="h-5 w-5" />, label: 'Kategori' },
  { href: '/admin/stock', icon: <Layers className="h-5 w-5" />, label: 'Stok' },
  { href: '/admin/transactions', icon: <Receipt className="h-5 w-5" />, label: 'Transaksi' },
  { href: '/admin/reports', icon: <BarChart3 className="h-5 w-5" />, label: 'Laporan' },
  { href: '/admin/employees', icon: <Users className="h-5 w-5" />, label: 'Karyawan' },
  { href: '/admin/tables', icon: <Table2 className="h-5 w-5" />, label: 'Meja & QR' },
  { href: '/admin/settings', icon: <Settings className="h-5 w-5" />, label: 'Pengaturan' },
]

const cashierNavItems: NavItem[] = [
  { href: '/cashier/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
  { href: '/cashier/pos', icon: <ShoppingCart className="h-5 w-5" />, label: 'Kasir' },
  { href: '/cashier/qr-orders', icon: <QrCode className="h-5 w-5" />, label: 'Pesanan QR' },
  { href: '/cashier/transactions', icon: <Receipt className="h-5 w-5" />, label: 'Riwayat Transaksi' },
]

const kitchenNavItems: NavItem[] = [
  { href: '/kitchen', icon: <ChefHat className="h-5 w-5" />, label: 'Monitor Dapur (KDS)' },
]

interface SidebarProps {
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN'
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = role === 'ADMIN' ? adminNavItems : role === 'KITCHEN' ? kitchenNavItems : cashierNavItems

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      logout()
      router.push('/login')
    } catch {
      toast.error('Gagal logout')
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-sidebar-border',
        collapsed && 'justify-center px-2'
      )}>
        <div className="flex-shrink-0 w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md">
          <Store className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">POS Kasir</h1>
            <p className="text-xs text-sidebar-foreground/60">
              {role === 'ADMIN' ? 'Administrator' : role === 'KITCHEN' ? 'Koki / Dapur' : 'Kasir'}
            </p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn('flex-shrink-0', isActive && 'text-sidebar-primary-foreground')}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className={cn('p-2 border-t border-sidebar-border', collapsed && 'px-1')}>
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-sidebar-foreground hover:bg-red-500/10 hover:text-red-500 transition-all duration-200',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse button (desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center h-8 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
      >
        <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground',
          'border-r border-sidebar-border shadow-2xl transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 bg-sidebar text-sidebar-foreground',
          'border-r border-sidebar-border transition-all duration-300 flex-shrink-0',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
