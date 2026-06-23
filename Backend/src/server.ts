import { createApp } from './app.js'
import { config } from './config.js'
import { closeDatabase, connectDatabase } from './database.js'

await connectDatabase()
const server = createApp().listen(config.PORT, () => {
  console.log(`DimensionGear API listening on http://localhost:${config.PORT}`)
})

async function shutdown() {
  server.close()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
