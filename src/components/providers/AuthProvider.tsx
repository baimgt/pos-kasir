'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // Verify auth session on mount
    const verifyAuth = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setUser({
              userId: data.data._id,
              email: data.data.email,
              role: data.data.role,
              name: data.data.name,
            })
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    verifyAuth()
  }, [setUser, setLoading])

  return <>{children}</>
}
