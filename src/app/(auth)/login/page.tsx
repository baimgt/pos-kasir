'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginInput } from '@/lib/validations'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { Eye, EyeOff, Store, Lock, Mail, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const { setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.message || 'Login gagal')
        return
      }

      setUser({
        userId: result.data._id,
        email: result.data.email,
        role: result.data.role,
        name: result.data.name,
      })

      toast.success(`Selamat datang, ${result.data.name}!`)

      if (result.data.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else if (result.data.role === 'KITCHEN') {
        router.push('/kitchen')
      } else {
        router.push('/cashier/dashboard')
      }
    } catch {
      toast.error('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Glass card */}
      <div className="relative bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
              <Store className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">POS Kasir</h1>
            <p className="text-white/60 text-sm mt-1">Masuk ke sistem kasir</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
            <p className="text-xs text-white/60 text-center font-semibold uppercase tracking-wider">
              Akun Demo (Setelah jalankan npm run seed)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'admin@poskasir.com')
                  setValue('password', 'admin123')
                }}
                className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <p className="text-xs font-bold text-blue-300">👑 Admin</p>
                <p className="text-[10px] text-white/50 mt-1 truncate">admin@...</p>
                <p className="text-[10px] text-white/40">admin123</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'kasir@poskasir.com')
                  setValue('password', 'kasir123')
                }}
                className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <p className="text-xs font-bold text-emerald-300">🧾 Kasir</p>
                <p className="text-[10px] text-white/50 mt-1 truncate">kasir@...</p>
                <p className="text-[10px] text-white/40">kasir123</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'koki@poskasir.com')
                  setValue('password', 'koki123')
                }}
                className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <p className="text-xs font-bold text-amber-300">👨‍🍳 Koki</p>
                <p className="text-[10px] text-white/50 mt-1 truncate">koki@...</p>
                <p className="text-[10px] text-white/40">koki123</p>
              </button>
            </div>
            <p className="text-[10px] text-white/30 text-center">Klik kartu untuk mengisi otomatis</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-white/30 text-xs mt-6">
        © 2026 POS Kasir. Sistem Point of Sale Modern.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-sm font-medium">Memuat halaman login...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
