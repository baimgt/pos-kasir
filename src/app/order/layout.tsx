import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pesan Online',
  description: 'Scan QR Code dan pesan langsung dari meja Anda',
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
