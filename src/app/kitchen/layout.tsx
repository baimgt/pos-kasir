import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: {
    default: 'Monitor Dapur (KDS)',
    template: '%s | Dapur | POS Kasir',
  },
}

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  // Hanya KOKI dan ADMIN yang boleh mengakses halaman dapur
  if (user.role !== 'KITCHEN' && user.role !== 'ADMIN') {
    redirect('/cashier/dashboard')
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={user.role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
