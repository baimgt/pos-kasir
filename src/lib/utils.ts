/**
 * Utility functions for the POS application
 */

/**
 * Format a number as Indonesian Rupiah currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a date as Indonesian locale string
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }
  return new Intl.DateTimeFormat('id-ID', defaultOptions).format(new Date(date))
}

/**
 * Format a date with time
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/**
 * Generate unique order number
 * Format: TRX-YYYYMMDD-XXXX
 */
export function generateOrderNumber(source: 'POS' | 'QR' = 'POS'): string {
  const prefix = source === 'QR' ? 'ORD' : 'TRX'
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 9999) + 1
  const suffix = String(random).padStart(4, '0')
  return `${prefix}-${year}${month}${day}-${suffix}`
}

/**
 * Generate unique QR token
 */
export function generateQRToken(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}`.toUpperCase()
}

/**
 * Generate slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate unique slug with suffix if needed
 */
export async function generateUniqueSlug(
  base: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = generateSlug(base)
  let suffix = 0

  while (await checkExists(slug)) {
    suffix++
    slug = `${generateSlug(base)}-${suffix}`
  }

  return slug
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Validate Indonesian phone number
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+62|62|0)[2-9]\d{7,11}$/
  return phoneRegex.test(phone.replace(/\s|-/g, ''))
}

/**
 * Truncate text to a given length
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.substring(0, length)}...`
}

/**
 * Convert File to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Get start and end of day
 */
export function getDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * Get start and end of month
 */
export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Parse and sanitize numeric input
 */
export function parseNumber(value: string | number): number {
  const parsed = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  return isNaN(parsed) ? 0 : parsed
}
