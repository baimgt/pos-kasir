/**
 * Global type definitions for the POS application
 */

// ========================
// COMMON TYPES
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

// ========================
// USER TYPES
// ========================

export interface User {
  _id: string
  name: string
  email: string
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN'
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface AuthUser {
  userId: string
  email: string
  role: 'ADMIN' | 'CASHIER' | 'KITCHEN'
  name: string
}

// ========================
// PRODUCT TYPES
// ========================

export interface Category {
  _id: string
  name: string
  slug: string
  description?: string
  image?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Product {
  _id: string
  name: string
  slug: string
  sku?: string
  barcode?: string
  description?: string
  image?: string
  price: number
  costPrice?: number
  stock: number
  minimumStock: number
  trackStock?: boolean
  productMode?: 'STOCK' | 'SALES'
  soldToday?: number
  soldThisMonth?: number
  soldTotal?: number
  revenueThisMonth?: number
  categoryId: string | Category
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductWithCategory extends Product {
  categoryId: Category
}

// ========================
// ORDER TYPES
// ========================

export interface CartItem {
  productId: string
  productName: string
  productImage?: string
  price: number
  quantity: number
  subtotal: number
}

export interface OrderItem {
  productId: string
  productName: string
  productImage?: string
  quantity: number
  price: number
  subtotal: number
}

export type OrderSource = 'POS' | 'QR'
export type PaymentMethod = 'CASH' | 'MIDTRANS'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED'

export interface Order {
  _id: string
  orderNumber: string
  source: OrderSource
  tableId?: string | Table
  tableName?: string
  customerName?: string
  customerEmail?: string
  notes?: string
  items: OrderItem[]
  subtotal: number
  discount: number
  discountType?: 'PERCENTAGE' | 'FIXED'
  tax: number
  taxPercentage: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  cashierId?: string | User
  cashierName?: string
  cashAmount?: number
  changeAmount?: number
  midtransOrderId?: string
  midtransTransactionId?: string
  midtransPaymentType?: string
  midtransToken?: string
  createdAt: string
  updatedAt: string
}

// ========================
// TABLE TYPES
// ========================

export interface Table {
  _id: string
  name: string
  tableNumber: string
  qrCode?: string
  qrToken: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ========================
// STOCK MOVEMENT TYPES
// ========================

export type StockMovementType = 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'RETURN'

export interface StockMovement {
  _id: string
  productId: string | Product
  productName: string
  type: StockMovementType
  quantity: number
  previousStock: number
  newStock: number
  referenceId?: string
  referenceNumber?: string
  notes?: string
  userId?: string | User
  userName?: string
  createdAt: string
}

// ========================
// SETTINGS TYPES
// ========================

export interface Settings {
  _id: string
  storeName: string
  storeLogo?: string
  storeAddress?: string
  storePhone?: string
  storeEmail?: string
  receiptFooter?: string
  taxEnabled: boolean
  taxPercentage: number
  discountEnabled: boolean
  currency: string
  currencySymbol: string
  cashPaymentEnabled: boolean
  midtransEnabled: boolean
  midtransServerKey?: string
  midtransClientKey?: string
  midtransIsProduction?: boolean
  qrOrderingEnabled: boolean
  qrAllowCashPayment: boolean
  qrAllowMidtransPayment: boolean
  defaultProductViewMode?: 'STOCK' | 'SALES' | 'HYBRID'
  // Email / SMTP
  smtpEnabled?: boolean
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPass?: string
  smtpFromName?: string
  smtpFromEmail?: string
  updatedAt: string
}

// ========================
// REPORT TYPES
// ========================

export interface SalesReport {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  cashRevenue: number
  midtransRevenue: number
  totalCashOrders: number
  totalMidtransOrders: number
  totalQrOrders: number
  totalPosOrders: number
}

export interface DailySales {
  date: string
  revenue: number
  orders: number
}

export interface TopProduct {
  productId: string
  productName: string
  totalQuantity: number
  totalRevenue: number
}

export interface CashierReport {
  cashierId: string
  cashierName: string
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
}

// ========================
// DASHBOARD TYPES
// ========================

export interface DashboardStats {
  todayRevenue: number
  todayOrders: number
  monthRevenue: number
  totalProductsSold: number
  qrOrders: number
  cashOrders: number
  midtransOrders: number
  revenueChange: number
  ordersChange: number
}
