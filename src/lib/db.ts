import mongoose from 'mongoose'

// Ensure all Mongoose models are registered in every connection to prevent MissingSchemaError on populate
import '@/models/User'
import '@/models/Table'
import '@/models/Category'
import '@/models/Product'
import '@/models/Order'
import '@/models/StockMovement'
import '@/models/Settings'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pos-kasir'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Use a global variable to preserve the value across module reloads in development
declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    }

    cached.promise = mongoose.connect(MONGODB_URI!, opts)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default connectDB
