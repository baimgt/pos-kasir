'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { TopNav } from '@/components/layout/TopNav'

interface CashierLayoutClientProps {
  children: React.ReactNode
}

export function CashierLayoutClient({ children }: CashierLayoutClientProps) {
  const pathname = usePathname()
  const isPos = pathname === '/cashier/pos'

  if (isPos) {
    return (
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    )
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </>
  )
}
