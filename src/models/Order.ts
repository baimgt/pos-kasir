import mongoose, { Document, Schema, Model } from 'mongoose'

export type OrderSource = 'POS' | 'QR'
export type PaymentMethod = 'CASH' | 'MIDTRANS'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'

export interface IOrderItem {
  productId: mongoose.Types.ObjectId
  productName: string
  productImage?: string
  quantity: number
  price: number
  subtotal: number
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId
  orderNumber: string
  source: OrderSource
  tableId?: mongoose.Types.ObjectId
  tableName?: string
  customerName?: string
  customerEmail?: string
  notes?: string
  items: IOrderItem[]
  subtotal: number
  discount: number
  discountType?: 'PERCENTAGE' | 'FIXED'
  tax: number
  taxPercentage: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  cashierId?: mongoose.Types.ObjectId
  cashierName?: string
  cashAmount?: number
  changeAmount?: number
  midtransOrderId?: string
  midtransTransactionId?: string
  midtransPaymentType?: string
  midtransToken?: string
  createdAt: Date
  updatedAt: Date
}

const orderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  productImage: String,
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative'],
  },
})

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    source: {
      type: String,
      enum: ['POS', 'QR'],
      required: true,
      default: 'POS',
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: 'Table',
    },
    tableName: String,
    customerName: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Format email tidak valid'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items: IOrderItem[]) {
          return items && items.length > 0
        },
        message: 'Order must have at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'FIXED',
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Tax percentage cannot be negative'],
      max: [100, 'Tax percentage cannot exceed 100'],
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'MIDTRANS'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
    },
    orderStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    cashierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cashierName: String,
    cashAmount: {
      type: Number,
      min: [0, 'Cash amount cannot be negative'],
    },
    changeAmount: {
      type: Number,
      min: [0, 'Change amount cannot be negative'],
    },
    midtransOrderId: String,
    midtransTransactionId: String,
    midtransPaymentType: String,
    midtransToken: String,
  },
  {
    timestamps: true,
  }
)

orderSchema.index({ orderNumber: 1 })
orderSchema.index({ paymentStatus: 1 })
orderSchema.index({ orderStatus: 1 })
orderSchema.index({ cashierId: 1 })
orderSchema.index({ tableId: 1 })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ source: 1 })
orderSchema.index({ midtransOrderId: 1 })

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema)

export default Order
