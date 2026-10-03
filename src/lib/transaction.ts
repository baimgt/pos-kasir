import mongoose, { ClientSession } from 'mongoose'

let hasReplicaSetSupport: boolean | null = null

/**
 * Checks if the current MongoDB connection supports multi-document transactions
 * (requires Replica Set or mongos).
 */
export async function supportsTransactions(): Promise<boolean> {
  if (hasReplicaSetSupport !== null) return hasReplicaSetSupport

  try {
    if (!mongoose.connection.db) return false
    const admin = mongoose.connection.db.admin()
    const isMaster = await admin.command({ isMaster: 1 })
    // isMaster returns setName if replica set, or msg: 'isdbgrid' if mongos
    hasReplicaSetSupport = Boolean(isMaster.setName || isMaster.msg === 'isdbgrid')
    return hasReplicaSetSupport
  } catch (err) {
    console.warn('Could not determine replica set status, disabling transactions:', err)
    hasReplicaSetSupport = false
    return false
  }
}

/**
 * Executes a callback within a MongoDB transaction if the connected MongoDB instance
 * supports transactions (replica set / mongos). Otherwise, executes directly.
 */
export async function runWithTransaction<T>(
  callback: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const isSupported = await supportsTransactions()

  if (!isSupported) {
    return callback(undefined)
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const result = await callback(session)
    await session.commitTransaction()
    return result
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    await session.endSession()
  }
}
