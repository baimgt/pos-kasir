'use client'

import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Order } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Printer, X } from 'lucide-react'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order
}

export function ReceiptModal({ isOpen, onClose, order }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Struk-${order.orderNumber}`,
    onAfterPrint: () => {
      // Optional: close modal after print
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Struk Pembayaran" size="sm">
      <div className="space-y-4">
        {/* Receipt Preview */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div ref={receiptRef} className="receipt-container p-4 bg-white text-black">
            <ReceiptContent order={order} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="h-4 w-4" />
            Tutup
          </Button>
          <Button onClick={() => handlePrint()} className="flex-1">
            <Printer className="h-4 w-4" />
            Cetak Struk
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface ReceiptContentProps {
  order: Order
  storeName?: string
  storeAddress?: string
  storePhone?: string
  receiptFooter?: string
}

export function ReceiptContent({
  order,
  storeName = 'POS Kasir',
  storeAddress,
  storePhone,
  receiptFooter = 'Terima kasih atas kunjungan Anda!',
}: ReceiptContentProps) {
  return (
    <div className="receipt-58mm mx-auto" style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', lineHeight: '1.4', color: '#000' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{storeName}</div>
        {storeAddress && <div style={{ fontSize: '10px' }}>{storeAddress}</div>}
        {storePhone && <div style={{ fontSize: '10px' }}>Telp: {storePhone}</div>}
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
      </div>

      {/* Transaction Info */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>No Transaksi</span>
          <span style={{ fontWeight: 'bold' }}>{order.orderNumber}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tanggal</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>
        {order.cashierName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Kasir</span>
            <span>{order.cashierName}</span>
          </div>
        )}
        {order.tableName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Meja</span>
            <span>{order.tableName}</span>
          </div>
        )}
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
      </div>

      {/* Items */}
      <div style={{ marginBottom: '8px' }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: '4px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{item.productName}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
              <span>{formatCurrency(item.subtotal)}</span>
            </div>
          </div>
        ))}
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
      </div>

      {/* Totals */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Diskon</span>
            <span>- {formatCurrency(order.discount)}</span>
          </div>
        )}
        {order.tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pajak ({order.taxPercentage}%)</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '4px' }}>
          <span>TOTAL</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
      </div>

      {/* Payment */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Pembayaran</span>
          <span>{order.paymentMethod === 'CASH' ? 'Tunai' : 'Midtrans'}</span>
        </div>
        {order.paymentMethod === 'CASH' && order.cashAmount && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Uang Diterima</span>
              <span>{formatCurrency(order.cashAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Kembalian</span>
              <span>{formatCurrency(order.changeAmount || 0)}</span>
            </div>
          </>
        )}
        {order.paymentMethod === 'MIDTRANS' && order.midtransPaymentType && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Via</span>
            <span>{order.midtransPaymentType}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
        <div style={{ fontSize: '10px' }}>{receiptFooter}</div>
        <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
          {order.orderNumber}
        </div>
      </div>
    </div>
  )
}
