import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'ADMIN') {
    redirect('/admin/dashboard')
  } else if (user.role === 'KITCHEN') {
    redirect('/kitchen')
  } else {
    redirect('/cashier/dashboard')
  }
}
