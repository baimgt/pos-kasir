import mongoose, { Document, Schema, Model } from 'mongoose'

export type StockMovementType = 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'RETURN'

export interface IStockMovement extends Document {
  _id: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  productName: string
  type: StockMovementType
  quantity: number
  previousStock: number
  newStock: number
  referenceId?: mongoose.Types.ObjectId
  referenceNumber?: string
  notes?: string
  userId?: mongoose.Types.ObjectId
  userName?: string
  createdAt: Date
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['SALE', 'RESTOCK', 'ADJUSTMENT', 'RETURN'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    referenceNumber: String,
    notes: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

stockMovementSchema.index({ productId: 1 })
stockMovementSchema.index({ type: 1 })
stockMovementSchema.index({ referenceId: 1 })
stockMovementSchema.index({ createdAt: -1 })

const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>('StockMovement', stockMovementSchema)

export default StockMovement
