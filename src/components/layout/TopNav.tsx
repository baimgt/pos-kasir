'use client'

import { useTheme } from 'next-themes'
import { useAuthStore } from '@/store/authStore'
import { Bell, Sun, Moon, User, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

interface TopNavProps {
  title?: string
}

export function TopNav({ title }: TopNavProps) {
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      logout()
      router.push('/login')
    } catch {
      toast.error('Gagal logout')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6">
      {/* Title - left side with spacer for mobile hamburger */}
      <div className="flex-1 ml-12 lg:ml-0">
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground leading-none">{user?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'KITCHEN' ? 'Koki' : 'Kasir'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg py-1 animate-fade-in">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
