import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ITable extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  tableNumber: string
  qrCode?: string
  qrToken: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const tableSchema = new Schema<ITable>(
  {
    name: {
      type: String,
      required: [true, 'Table name is required'],
      trim: true,
    },
    tableNumber: {
      type: String,
      required: [true, 'Table number is required'],
      unique: true,
      trim: true,
    },
    qrCode: {
      type: String,
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
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

const Table: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>('Table', tableSchema)

export default Table
