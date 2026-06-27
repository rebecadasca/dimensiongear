import { createApp } from './app.js'
import { config } from './config.js'
import { closeDatabase, connectDatabase } from './database.js'

const server = createApp().listen(config.PORT, '0.0.0.0', () => {
  console.log(`DimensionGear API listening on port ${config.PORT}`)
})

void connectDatabase()
  .then(() => {
    console.log('MongoDB connected')
  })
  .catch((error: unknown) => {
    console.error('Failed to connect to MongoDB', error)
    server.close(() => process.exit(1))
  })

async function shutdown() {
  server.close()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
