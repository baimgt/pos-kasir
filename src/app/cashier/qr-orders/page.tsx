import { QrOrdersView } from '@/components/orders/QrOrdersView'

export const metadata = {
  title: 'Pesanan QR Meja - Kasir POS',
}

export default function CashierQrOrdersPage() {
  return <QrOrdersView title="Pesanan QR Masuk (Kasir)" />
}
