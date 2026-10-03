import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ISettings extends Document {
  _id: mongoose.Types.ObjectId
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
  midtransIsProduction: boolean
  qrOrderingEnabled: boolean
  qrAllowCashPayment: boolean
  qrAllowMidtransPayment: boolean
  defaultProductViewMode: 'STOCK' | 'SALES' | 'HYBRID'
  // Email / SMTP
  smtpEnabled: boolean
  smtpHost?: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser?: string
  smtpPass?: string
  smtpFromName?: string
  smtpFromEmail?: string
  updatedAt: Date
}

const settingsSchema = new Schema<ISettings>(
  {
    storeName: {
      type: String,
      required: true,
      default: 'POS Kasir',
    },
    storeLogo: String,
    storeAddress: String,
    storePhone: String,
    storeEmail: String,
    receiptFooter: {
      type: String,
      default: 'Terima kasih atas kunjungan Anda!',
    },
    taxEnabled: {
      type: Boolean,
      default: false,
    },
    taxPercentage: {
      type: Number,
      default: 11,
      min: 0,
      max: 100,
    },
    discountEnabled: {
      type: Boolean,
      default: true,
    },
    currency: {
      type: String,
      default: 'IDR',
    },
    currencySymbol: {
      type: String,
      default: 'Rp',
    },
    cashPaymentEnabled: {
      type: Boolean,
      default: true,
    },
    midtransEnabled: {
      type: Boolean,
      default: false,
    },
    midtransServerKey: {
      type: String,
      default: '',
    },
    midtransClientKey: {
      type: String,
      default: '',
    },
    midtransIsProduction: {
      type: Boolean,
      default: false,
    },
    qrOrderingEnabled: {
      type: Boolean,
      default: true,
    },
    qrAllowCashPayment: {
      type: Boolean,
      default: true,
    },
    qrAllowMidtransPayment: {
      type: Boolean,
      default: false,
    },
    defaultProductViewMode: {
      type: String,
      enum: ['STOCK', 'SALES', 'HYBRID'],
      default: 'STOCK',
    },
    // Email / SMTP settings
    smtpEnabled: {
      type: Boolean,
      default: false,
    },
    smtpHost: {
      type: String,
      default: '',
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpSecure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      default: '',
    },
    smtpPass: {
      type: String,
      default: '',
    },
    smtpFromName: {
      type: String,
      default: '',
    },
    smtpFromEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

const Settings: Model<ISettings> =
  mongoose.models.Settings ||
  mongoose.model<ISettings>('Settings', settingsSchema)

export default Settings
