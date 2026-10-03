'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { PaymentStatus, OrderStatus } from '@/types'

interface StatusBadgeProps {
  status: PaymentStatus | OrderStatus | string
  type?: 'payment' | 'order'
}

export function StatusBadge({ status, type = 'payment' }: StatusBadgeProps) {
  const paymentStyles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
  }

  const orderStyles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    READY: 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
  }

  const paymentLabels: Record<string, string> = {
    PENDING: 'Menunggu',
    PAID: 'Dibayar',
    FAILED: 'Gagal',
    EXPIRED: 'Kadaluarsa',
    CANCELLED: 'Dibatalkan',
  }

  const orderLabels: Record<string, string> = {
    PENDING: 'Menunggu',
    CONFIRMED: 'Dikonfirmasi',
    PROCESSING: 'Diproses',
    READY: 'Siap',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
  }

  const styles = type === 'payment' ? paymentStyles : orderStyles
  const labels = type === 'payment' ? paymentLabels : orderLabels

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status] || 'bg-gray-100 text-gray-600'
      )}
    >
      {labels[status] || status}
    </span>
  )
}

// Payment method badge
interface PaymentMethodBadgeProps {
  method: 'CASH' | 'MIDTRANS' | string
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
  const styles: Record<string, string> = {
    CASH: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
    MIDTRANS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  }

  const labels: Record<string, string> = {
    CASH: '💵 Tunai',
    MIDTRANS: '💳 Midtrans',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[method] || 'bg-gray-100 text-gray-600'
      )}
    >
      {labels[method] || method}
    </span>
  )
}

// Source badge
interface SourceBadgeProps {
  source: 'POS' | 'QR' | string
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const styles: Record<string, string> = {
    POS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
    QR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  }

  const labels: Record<string, string> = {
    POS: '🖥️ POS',
    QR: '📱 QR Order',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[source] || 'bg-gray-100 text-gray-600'
      )}
    >
      {labels[source] || source}
    </span>
  )
}
