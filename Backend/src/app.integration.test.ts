import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import supertest, { type Agent } from 'supertest'
import { Decimal128, ObjectId } from 'mongodb'

let replicaSet: MongoMemoryReplSet
let agent: Agent
let closeDatabase: () => Promise<void>
let customProductSlug: string
let customComponentId: ObjectId
let customOptionId: ObjectId
let customValueId: ObjectId

describe('customer API smoke test', () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    process.env.MONGODB_URI = replicaSet.getUri()
    process.env.MONGODB_DB_NAME = 'dimensiongear_test'
    process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

    const databaseModule = await import('./database.js')
    const { createApp } = await import('./app.js')
    const database = await databaseModule.connectDatabase()
    closeDatabase = databaseModule.closeDatabase

    const categoryId = new ObjectId()
    await database.collection('categoriiProduse').insertOne({
      _id: categoryId,
      creatLa: new Date(),
      denumire: 'Mice',
      status: 'ACTIVA',
    })
    await database.collection('produse').insertOne({
      _id: new ObjectId(),
      categorieId: categoryId,
      creatLa: new Date(),
      culori: [],
      denumire: 'API Test Mouse',
      descriere: 'Test product',
      galerie: [{ alt: 'Test', id: 'image-01', isPrimary: true, src: '/test.png' }],
      moneda: 'RON',
      numarReviewuri: 0,
      pretBaza: Decimal128.fromString('199.99'),
      rating: 0,
      sku: 'TEST-MOUSE-1',
      slug: 'api-test-mouse',
      specificatii: {},
      status: 'ACTIV',
      taguri: [],
      tipProdus: 'SIMPLU',
    })
    const customProductId = new ObjectId()
    customComponentId = new ObjectId()
    customOptionId = new ObjectId()
    customValueId = new ObjectId()
    customProductSlug = 'api-custom-mouse'
    await database.collection('produse').insertOne({
      _id: customProductId,
      categorieId: categoryId,
      creatLa: new Date(),
      culori: [],
      denumire: 'API Custom Mouse',
      descriere: 'Custom test product',
      detaliiPersonalizare: {
        durataProductieEstimataZile: 3,
        model3DUrl: '/models/optimized/ice_claw_mouse.optimized.glb',
        pretMinimEstimat: Decimal128.fromString('249.99'),
      },
      galerie: [{ alt: 'Custom test', id: 'image-01', isPrimary: true, src: '/custom-test.png' }],
      moneda: 'RON',
      numarReviewuri: 0,
      pretBaza: Decimal128.fromString('249.99'),
      rating: 0,
      sku: 'TEST-CUSTOM-MOUSE-1',
      slug: customProductSlug,
      specificatii: {},
      status: 'ACTIV',
      taguri: [],
      tipProdus: 'PERSONALIZABIL',
    })
    await database.collection('componentePersonalizabile').insertOne({
      _id: customComponentId,
      cheie: 'shell',
      denumire: 'Carcasa',
      ordineAfisare: 1,
      produsId: customProductId,
      status: 'ACTIVA',
    })
    await database.collection('optiuniPersonalizare').insertOne({
      _id: customOptionId,
      cheie: 'shell-color',
      componentaPersonalizabilaId: customComponentId,
      esteObligatorie: true,
      nume: 'Culoare carcasa',
      ordineAfisare: 1,
      status: 'ACTIVA',
      tipOptiune: 'CULOARE',
    })
    await database.collection('valoriOptiuniPersonalizare').insertOne({
      _id: customValueId,
      cheie: 'black',
      codCuloare: '#020806',
      inStoc: true,
      optiunePersonalizareId: customOptionId,
      ordineAfisare: 1,
      pretSuplimentar: Decimal128.fromString('0.00'),
      status: 'ACTIVA',
      valoare: 'Negru',
    })
    agent = supertest.agent(createApp())
  }, 120000)

  afterAll(async () => {
    await closeDatabase?.()
    await replicaSet?.stop()
  })

  it('serves catalog data from MongoDB and protects the cart', async () => {
    const catalog = await agent.get('/api/v1/products').expect(200)
    const standardProduct = catalog.body.products.find((product: any) => product.id === 'api-test-mouse')
    expect(standardProduct.pricing.current).toBe('199.99')
    await supertest(agent.app).get('/api/v1/cart').expect(401)
  })

  it('registers, sets the session cookie and returns the account', async () => {
    const registration = await agent.post('/api/v1/auth/register').send({
      email: 'api@example.com',
      name: 'API User',
      password: 'Secure-password1!',
    }).expect(201)
    expect(registration.headers['set-cookie']?.[0]).toContain('HttpOnly')
    const me = await agent.get('/api/v1/auth/me').expect(200)
    expect(me.body.user.email).toBe('api@example.com')
  })

  it('adds a customizable product with defaults and stores preview sessions outside history', async () => {
    const preview = await agent.post('/api/v1/configuration-sessions/preview').send({
      productSlug: customProductSlug,
      selections: [{
        componentId: customComponentId.toHexString(),
        optionId: customOptionId.toHexString(),
        valueId: customValueId.toHexString(),
      }],
    }).expect(201)
    expect(preview.body.id).toHaveLength(24)

    const emptyHistory = await agent.get('/api/v1/users/me/configurations').expect(200)
    expect(emptyHistory.body.configurations).toHaveLength(0)

    const cart = await agent.post('/api/v1/cart/items/default-configuration').send({
      productSlug: customProductSlug,
      quantity: 1,
    }).expect(201)
    expect(cart.body.items[0].configurationId).toHaveLength(24)
    expect(cart.body.items[0].variantName).toBe('Custom configuration')

    const history = await agent.get('/api/v1/users/me/configurations').expect(200)
    expect(history.body.configurations).toHaveLength(1)
    expect(history.body.configurations[0].selections[0].value).toBe('Negru')
  })
})
