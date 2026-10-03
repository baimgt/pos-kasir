import mongoose, { Document, Schema, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export type UserRole = 'ADMIN' | 'CASHIER' | 'KITCHEN'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  password: string
  role: UserRole
  isActive: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'CASHIER', 'KITCHEN'],
      default: 'CASHIER',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
})

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// Remove password from JSON output
userSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete (ret as unknown as Record<string, unknown>).password
    return ret
  },
})

// Force model recompile in development to prevent stale enum cache issues
if (process.env.NODE_ENV !== 'production' && mongoose.models.User) {
  delete (mongoose.models as Record<string, unknown>).User
}

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema)

export default User
