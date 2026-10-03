import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: {
    default: 'Admin Dashboard',
    template: '%s | Admin | POS Kasir',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/cashier/dashboard')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role="ADMIN" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
