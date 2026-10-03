import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AuthUser } from '@/types'

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      setUser: (user: AuthUser | null) => {
        set({ user })
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },

      logout: () => {
        set({ user: null })
      },
    }),
    {
      name: 'pos-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
