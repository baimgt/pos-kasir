/**
 * Midtrans payment gateway integration
 * Server-side only - never use on client
 */

export interface MidtransTransactionDetail {
  orderId: string
  grossAmount: number
}

export interface MidtransCustomerDetail {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
}

export interface MidtransItemDetail {
  id: string
  price: number
  quantity: number
  name: string
  category?: string
}

export interface MidtransCreateTokenParams {
  transactionDetails: MidtransTransactionDetail
  customerDetails?: MidtransCustomerDetail
  itemDetails?: MidtransItemDetail[]
  enabledPayments?: string[]
}

export interface MidtransTokenResponse {
  token: string
  redirectUrl: string
}

export interface MidtransNotification {
  transaction_time: string
  transaction_status: string
  transaction_id: string
  status_message: string
  status_code: string
  signature_key: string
  payment_type: string
  order_id: string
  merchant_id: string
  masked_card?: string
  gross_amount: string
  fraud_status?: string
  currency: string
}

import connectDB from '@/lib/db'
import Settings from '@/models/Settings'

export interface MidtransConfig {
  serverKey: string
  clientKey: string
  isProduction: boolean
  baseUrl: string
  snapUrl: string
  apiUrl: string
}

export async function getMidtransConfig(): Promise<MidtransConfig> {
  let serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  let clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
  let isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  try {
    await connectDB()
    const settings = await Settings.findOne().lean()
    if (settings) {
      if (settings.midtransServerKey && settings.midtransServerKey.trim()) {
        serverKey = settings.midtransServerKey.trim()
      }
      if (settings.midtransClientKey && settings.midtransClientKey.trim()) {
        clientKey = settings.midtransClientKey.trim()
      }
      if (settings.midtransIsProduction !== undefined) {
        isProduction = settings.midtransIsProduction
      }
    }
  } catch (err) {
    console.warn('Error reading Midtrans settings from DB, using env fallback:', err)
  }

  const baseUrl = isProduction
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com'

  const snapUrl = isProduction
    ? 'https://app.midtrans.com/snap/v1'
    : 'https://app.sandbox.midtrans.com/snap/v1'

  const apiUrl = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2'

  return {
    serverKey,
    clientKey,
    isProduction,
    baseUrl,
    snapUrl,
    apiUrl,
  }
}

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true'

const BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com'

const SNAP_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1'

const API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2'

export async function getAuthHeader(customServerKey?: string): Promise<string> {
  const key = customServerKey || (await getMidtransConfig()).serverKey
  if (!key) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi di Pengaturan atau .env')
  }
  const credentials = Buffer.from(`${key}:`).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Create Snap token for payment
 * @returns token and redirect URL
 */
export async function createSnapToken(
  params: MidtransCreateTokenParams
): Promise<MidtransTokenResponse> {
  const config = await getMidtransConfig()
  const authHeader = await getAuthHeader(config.serverKey)

  const body = {
    transaction_details: {
      order_id: params.transactionDetails.orderId,
      gross_amount: params.transactionDetails.grossAmount,
    },
    customer_details: params.customerDetails
      ? {
          first_name: params.customerDetails.firstName,
          last_name: params.customerDetails.lastName || '',
          email: params.customerDetails.email,
          phone: params.customerDetails.phone,
        }
      : undefined,
    item_details: params.itemDetails?.map((item) => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity,
      name: item.name.substring(0, 50), // Midtrans name limit
      category: item.category,
    })),
    enabled_payments: params.enabledPayments,
  }

  const response = await fetch(`${config.snapUrl}/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Midtrans error: ${error.error_messages?.join(', ') || 'Unknown error'}`)
  }

  const data = await response.json()
  return {
    token: data.token,
    redirectUrl: data.redirect_url,
  }
}

/**
 * Get transaction status from Midtrans
 */
export async function getTransactionStatus(orderId: string): Promise<MidtransNotification> {
  const config = await getMidtransConfig()
  const authHeader = await getAuthHeader(config.serverKey)

  const response = await fetch(`${config.apiUrl}/${orderId}/status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Midtrans error: ${error.status_message || 'Unknown error'}`)
  }

  return response.json()
}

/**
 * Verify Midtrans notification signature
 * Signature = SHA512(order_id + status_code + gross_amount + server_key)
 */
export async function verifyMidtransSignature(
  notification: MidtransNotification
): Promise<boolean> {
  const config = await getMidtransConfig()
  if (!config.serverKey) return false

  const { order_id, status_code, gross_amount, signature_key } = notification
  const signatureString = `${order_id}${status_code}${gross_amount}${config.serverKey}`

  const encoder = new TextEncoder()
  const data = encoder.encode(signatureString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return hashHex === signature_key
}

/**
 * Determine if a Midtrans transaction is paid/successful
 */
export function isMidtransPaymentSuccessful(
  notification: MidtransNotification
): boolean {
  const { transaction_status, fraud_status } = notification

  if (transaction_status === 'capture') {
    return fraud_status === 'accept'
  }

  if (transaction_status === 'settlement') {
    return true
  }

  return false
}

/**
 * Determine if a Midtrans transaction is pending
 */
export function isMidtransPaymentPending(
  notification: MidtransNotification
): boolean {
  return notification.transaction_status === 'pending'
}

/**
 * Determine if a Midtrans transaction is failed/expired/cancelled
 */
export function isMidtransPaymentFailed(
  notification: MidtransNotification
): boolean {
  const failedStatuses = ['deny', 'cancel', 'expire', 'failure']
  return failedStatuses.includes(notification.transaction_status)
}

export { BASE_URL, SNAP_URL, API_URL }
