import { Db, MongoClient } from 'mongodb'
import { config } from './config.js'

let client: MongoClient | undefined
let database: Db | undefined

export async function connectDatabase() {
  if (database) return database

  client = new MongoClient(config.MONGODB_URI)
  await client.connect()
  database = client.db(config.MONGODB_DB_NAME)
  await database.command({ ping: 1 })
  return database
}

export function getDatabase() {
  if (!database) throw new Error('Database has not been connected')
  return database
}

export function getMongoClient() {
  if (!client) throw new Error('MongoDB client has not been connected')
  return client
}

export async function closeDatabase() {
  await client?.close()
  client = undefined
  database = undefined
}
