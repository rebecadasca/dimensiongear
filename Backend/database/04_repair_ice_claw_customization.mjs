import 'dotenv/config'
import { MongoClient } from 'mongodb'

const paletteKeys = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple']
const componentKeys = ['shell', 'side-panel', 'scroll-wheel', 'buttons', 'illuminated-logo']

const client = new MongoClient(process.env.MONGODB_URI)

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME ?? 'dimensiongear_db')
  const product = await db.collection('produse').findOne({ sku: 'MOU-NS6-3DC-001' })

  if (!product) {
    throw new Error('Ice Claw product not found')
  }

  const components = await db.collection('componentePersonalizabile')
    .find({ produsId: product._id, cheie: { $in: componentKeys } })
    .toArray()
  const options = await db.collection('optiuniPersonalizare')
    .find({ componentaPersonalizabilaId: { $in: components.map((component) => component._id) }, cheie: 'color' })
    .toArray()
  const result = await db.collection('valoriOptiuniPersonalizare').updateMany(
    { optiunePersonalizareId: { $in: options.map((option) => option._id) }, cheie: { $in: paletteKeys } },
    { $set: { status: 'ACTIVA' } },
  )

  console.log(JSON.stringify({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    product: product.denumire,
  }, null, 2))
} finally {
  await client.close()
}
