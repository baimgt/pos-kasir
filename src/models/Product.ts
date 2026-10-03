import mongoose, { Document, Schema, Model } from 'mongoose'

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId
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
  trackStock: boolean
  productMode: 'STOCK' | 'SALES'
  categoryId: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      sparse: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    image: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative'],
      default: 0,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    minimumStock: {
      type: Number,
      default: 5,
      min: [0, 'Minimum stock cannot be negative'],
    },
    trackStock: {
      type: Boolean,
      default: true,
    },
    productMode: {
      type: String,
      enum: ['STOCK', 'SALES'],
      default: 'STOCK',
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

// Auto-generate slug from name
productSchema.pre('save', function () {
  if (this.isModified('name') && !this.isModified('slug')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }
})

// Virtual for low stock check
productSchema.virtual('isLowStock').get(function () {
  if (this.trackStock === false || this.productMode === 'SALES') return false
  return this.stock <= this.minimumStock
})

productSchema.index({ categoryId: 1 })
productSchema.index({ isActive: 1 })
productSchema.index({ name: 'text', description: 'text' })

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)

export default Product
