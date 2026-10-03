import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import { CashierLayoutClient } from './CashierLayoutClient'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: {
    default: 'Kasir',
    template: '%s | Kasir | POS Kasir',
  },
}

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={user.role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <CashierLayoutClient>
          {children}
        </CashierLayoutClient>
      </div>
    </div>
  )
}
