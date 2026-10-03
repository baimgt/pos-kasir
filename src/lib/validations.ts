import { z } from 'zod'

// ========================
// AUTH VALIDATIONS
// ========================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(6, 'Password minimal 6 karakter'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ========================
// PRODUCT VALIDATIONS
// ========================

export const productSchema = z.object({
  name: z
    .string()
    .min(2, 'Nama produk minimal 2 karakter')
    .max(200, 'Nama produk maksimal 200 karakter'),
  slug: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z
    .string()
    .max(1000, 'Deskripsi maksimal 1000 karakter')
    .optional(),
  image: z.string().optional(),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  costPrice: z.number().min(0, 'Harga pokok tidak boleh negatif').optional(),
  stock: z.coerce
    .number()
    .int('Stok harus bilangan bulat')
    .min(0, 'Stok tidak boleh negatif')
    .default(0),
  minimumStock: z.coerce
    .number()
    .int('Minimum stok harus bilangan bulat')
    .min(0, 'Minimum stok tidak boleh negatif')
    .default(0),
  trackStock: z.boolean().default(true),
  productMode: z.enum(['STOCK', 'SALES']).default('STOCK'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  isActive: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>

// ========================
// CATEGORY VALIDATIONS
// ========================

export const categorySchema = z.object({
  name: z
    .string()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(100, 'Nama kategori maksimal 100 karakter'),
  slug: z.string().optional(),
  description: z
    .string()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  image: z.string().optional(),
  isActive: z.boolean().default(true),
})

export type CategoryInput = z.infer<typeof categorySchema>

// ========================
// ORDER VALIDATIONS
// ========================

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID wajib diisi'),
  quantity: z.number().int().min(1, 'Quantity minimal 1'),
})

export const createOrderSchema = z.object({
  source: z.enum(['POS', 'QR']).default('POS'),
  tableId: z.string().optional(),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email('Format email tidak valid').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notes: z.string().max(500).optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'Order harus memiliki setidaknya 1 item'),
  paymentMethod: z.enum(['CASH', 'MIDTRANS']),
  cashAmount: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('FIXED'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// ========================
// USER/EMPLOYEE VALIDATIONS
// ========================

export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter'),
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  password: z
    .string()
    .min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'CASHIER', 'KITCHEN']).default('CASHIER'),
  isActive: z.boolean().default(true),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z
      .string()
      .min(6, 'Password minimal 6 karakter')
      .optional()
      .or(z.literal(''))
      .nullable(),
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ========================
// TABLE VALIDATIONS
// ========================

export const tableSchema = z.object({
  name: z.string().min(1, 'Nama meja wajib diisi').max(100, 'Nama meja maksimal 100 karakter'),
  tableNumber: z.string().min(1, 'Nomor meja wajib diisi').max(20, 'Nomor meja maksimal 20 karakter'),
  isActive: z.boolean().default(true),
})

export type TableInput = z.infer<typeof tableSchema>

// ========================
// SETTINGS VALIDATIONS
// ========================

export const settingsSchema = z.object({
  storeName: z.string().min(1, 'Nama toko wajib diisi').max(200, 'Nama toko maksimal 200 karakter'),
  storeLogo: z.string().nullable().optional(),
  storeAddress: z.string().max(500, 'Alamat maksimal 500 karakter').nullable().optional(),
  storePhone: z.string().max(20, 'Nomor telepon maksimal 20 karakter').nullable().optional(),
  storeEmail: z.string().email('Format email tidak valid').nullable().optional().or(z.literal('')),
  receiptFooter: z.string().max(500, 'Footer struk maksimal 500 karakter').nullable().optional(),
  taxEnabled: z.boolean().default(false),
  taxPercentage: z.coerce.number().min(0).max(100).default(11),
  discountEnabled: z.boolean().default(true),
  currency: z.string().default('IDR'),
  currencySymbol: z.string().default('Rp'),
  cashPaymentEnabled: z.boolean().default(true),
  midtransEnabled: z.boolean().default(false),
  midtransServerKey: z.string().nullable().optional().or(z.literal('')),
  midtransClientKey: z.string().nullable().optional().or(z.literal('')),
  midtransIsProduction: z.boolean().default(false),
  qrOrderingEnabled: z.boolean().default(true),
  qrAllowCashPayment: z.boolean().default(true),
  qrAllowMidtransPayment: z.boolean().default(false),
  defaultProductViewMode: z.enum(['STOCK', 'SALES', 'HYBRID']).default('STOCK'),
  // Email / SMTP
  smtpEnabled: z.boolean().default(false),
  smtpHost: z.string().max(200).nullable().optional().or(z.literal('')),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().max(200).nullable().optional().or(z.literal('')),
  smtpPass: z.string().max(500).nullable().optional().or(z.literal('')),
  smtpFromName: z.string().max(200).nullable().optional().or(z.literal('')),
  smtpFromEmail: z.string().email('Format email pengirim tidak valid').nullable().optional().or(z.literal('')),
})

export type SettingsInput = z.infer<typeof settingsSchema>

// ========================
// STOCK MOVEMENT VALIDATIONS
// ========================

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID wajib diisi'),
  type: z.enum(['RESTOCK', 'ADJUSTMENT', 'RETURN']),
  quantity: z.number().int('Jumlah harus bilangan bulat').min(1, 'Jumlah minimal 1'),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
})

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
