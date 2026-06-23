import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { Decimal } from 'decimal.js'
import express, { type NextFunction, type Request, type Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { Decimal128, ObjectId } from 'mongodb'
import Stripe from 'stripe'
import { clearSession, issueSession, requireAuth } from './auth.js'
import { findProductBySlug, getCustomization, getDefaultConfigurationSelections, mapProduct, quoteConfiguration } from './catalog.js'
import { config } from './config.js'
import { getDatabase, getMongoClient } from './database.js'
import { AppError, errorHandler, notFoundHandler } from './errors.js'
import { decimal128, moneyString, sumMoney, toStripeMinorUnits } from './money.js'
import {
  addConfigurationCartItemSchema,
  addStandardCartItemSchema,
  addressSchema,
  addressUpdateSchema,
  cartItemUpdateSchema,
  checkoutSchema,
  googleLoginSchema,
  loginSchema,
  objectIdSchema,
  profileUpdateSchema,
  quoteSchema,
  registerSchema,
  saveConfigurationSchema,
} from './validators.js'

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID || undefined)
const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : undefined
const SHIPPING_FEE = decimal128('29.00')
const LOYALTY_POINTS_PER_REWARD = 100
const LOYALTY_REWARD_VALUE = new Decimal(10)

function routeParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') throw new AppError(400, 'INVALID_ROUTE_PARAMETER', 'Route parameter is invalid')
  return value
}

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) => (request: Request, response: Response, next: NextFunction) => {
  Promise.resolve(handler(request, response, next)).catch(next)
}

function userDto(user: any) {
  return {
    createdAt: user.creatLa.toISOString(),
    email: user.email,
    id: user._id.toHexString(),
    loyaltyPoints: user.puncteFidelitate ?? 0,
    name: user.nume,
    phone: user.telefon ?? '',
  }
}

function addressDto(address: any) {
  return {
    city: address.localitate,
    country: address.tara,
    county: address.judet,
    createdAt: address.creatLa.toISOString(),
    fullName: address.numeFacturare,
    id: address._id.toHexString(),
    isDefault: Boolean(address.implicita),
    label: address.eticheta ?? '',
    phone: address.telefonContact ?? '',
    postalCode: address.codPostal,
    street: address.strada,
  }
}

function configurationDto(configuration: any, product: any) {
  return {
    createdAt: configuration.creatLa.toISOString(),
    id: configuration._id.toHexString(),
    modelUrl: configuration.modelFinalUrl,
    price: moneyString(configuration.pretConfigurare),
    product: {
      id: product.slug,
      imageSrc: product.galerie?.find((image: any) => image.isPrimary)?.src ?? product.galerie?.[0]?.src,
      name: product.denumire,
    },
    selections: configuration.selectiiSnapshot.map((selection: any) => ({
      component: selection.componenta,
      componentId: selection.componentaPersonalizabilaId.toHexString(),
      hex: selection.codCuloare,
      option: selection.optiune,
      optionId: selection.optiunePersonalizareId.toHexString(),
      priceModifier: moneyString(selection.pretSuplimentar),
      value: selection.valoare,
      valueId: selection.valoareOptiuneId.toHexString(),
    })),
    status: configuration.status.toLowerCase(),
    updatedAt: configuration.actualizatLa.toISOString(),
  }
}

async function createConfiguration(
  userId: ObjectId,
  body: ReturnType<typeof saveConfigurationSchema.parse>,
  status: 'SALVATA' | 'ADAUGATA_IN_COS',
  session: any,
) {
  const createdSession = await createCustomizationSession(userId, body, 'FINALIZATA', session)
  const { now, quote, sessionId } = createdSession
  const configurationId = new ObjectId()
  await getDatabase().collection('configuratii3D').insertOne({
    _id: configurationId,
    actualizatLa: now,
    ...(body.sourceConfigurationId ? { configuratieSursaId: new ObjectId(body.sourceConfigurationId) } : {}),
    creatLa: now,
    modelFinalUrl: quote.product.detaliiPersonalizare.model3DUrl,
    pretConfigurare: quote.price,
    produsId: quote.product._id,
    salvatLa: now,
    selectiiSnapshot: quote.snapshots,
    sesiunePersonalizareId: sessionId,
    status,
    userId,
  }, { session })
  return { configurationId, quote }
}

async function createCustomizationSession(
  userId: ObjectId,
  body: ReturnType<typeof saveConfigurationSchema.parse>,
  status: 'FINALIZATA' | 'PREVIZUALIZARE',
  session: any,
) {
  const quote = await quoteConfiguration(body.productSlug, body.selections, session)
  const now = new Date()
  const sessionId = new ObjectId()
  await getDatabase().collection('sesiuniPersonalizare3D').insertOne({
    _id: sessionId,
    actualizatLa: now,
    creatLa: now,
    estimareCost: {
      adaosComercial: decimal128('0'),
      calculatLa: now,
      costMateriale: decimal128('0'),
      costOptiuni: quote.optionPrice,
      costProductie: decimal128('0'),
      pretEstimativ: quote.price,
    },
    produsId: quote.product._id,
    selectii: quote.snapshots,
    status,
    userId,
  }, { session })
  return { now, quote, sessionId }
}

async function activeCart(userId: ObjectId, create = false, session?: any) {
  const collection = getDatabase().collection('cosuri')
  let cart = await collection.findOne({ status: 'ACTIV', userId }, { session })
  if (!cart && create) {
    const now = new Date()
    const _id = new ObjectId()
    await collection.insertOne({ _id, actualizatLa: now, creatLa: now, linii: [], status: 'ACTIV', userId }, { session })
    cart = await collection.findOne({ _id }, { session })
  }
  return cart
}

async function cartDto(userId: ObjectId) {
  const cart = await activeCart(userId)
  if (!cart) return { id: null, items: [], totals: emptyTotals() }
  const productIds = cart.linii.map((line: any) => line.produsId)
  const products = await getDatabase().collection('produse').find({ _id: { $in: productIds } }).toArray()
  const items = cart.linii.map((line: any) => {
    const product = products.find((item) => item._id.equals(line.produsId))
    return {
      configurationId: line.configuratie3DId?.toHexString(),
      id: line.linieId.toHexString(),
      imageSrc: product?.galerie?.find((image: any) => image.isPrimary)?.src ?? product?.galerie?.[0]?.src,
      productCategory: product?.categorieId?.toHexString(),
      productId: product?.slug,
      productName: product?.denumire,
      quantity: line.cantitate,
      subtotal: moneyString(line.subtotal),
      unitPrice: moneyString(line.pretUnitate),
      variantName: line.configuratie3DId ? 'Custom configuration' : 'Standard build',
    }
  })
  return { id: cart._id.toHexString(), items, totals: calculateTotals(cart.linii) }
}

function emptyTotals() {
  return { discount: '0.00', loyaltyPointsUsed: 0, payNow: '0.00', remaining: '0.00', shipping: '0.00', subtotal: '0.00', total: '0.00' }
}

function calculateLoyaltyRedemption(points: number, orderTotal: Decimal) {
  if (points < LOYALTY_POINTS_PER_REWARD || orderTotal.lte(0)) {
    return { discount: new Decimal(0), pointsUsed: 0 }
  }
  const availablePointBlocks = Math.floor(points / LOYALTY_POINTS_PER_REWARD)
  const usableOrderBlocks = Math.floor(orderTotal.div(LOYALTY_REWARD_VALUE).toNumber())
  const blocksUsed = Math.min(availablePointBlocks, usableOrderBlocks)

  return {
    discount: LOYALTY_REWARD_VALUE.mul(blocksUsed),
    pointsUsed: blocksUsed * LOYALTY_POINTS_PER_REWARD,
  }
}

function calculateLoyaltyPointsEarned(total: any) {
  return Math.floor(new Decimal(total.toString()).mul('0.10').toNumber())
}

function calculateTotals(lines: any[], mode: 'full' | 'advance' = 'full', loyaltyPoints = 0, useLoyaltyPoints = false) {
  const subtotal = sumMoney(lines.map((line) => line.subtotal))
  const shipping = lines.length ? new Decimal(SHIPPING_FEE.toString()) : new Decimal(0)
  const totalBeforeDiscount = subtotal.plus(shipping)
  const loyalty = useLoyaltyPoints ? calculateLoyaltyRedemption(loyaltyPoints, totalBeforeDiscount) : { discount: new Decimal(0), pointsUsed: 0 }
  const total = Decimal.max(totalBeforeDiscount.minus(loyalty.discount), 0)
  const advancePayNow = Decimal.max(subtotal.minus(loyalty.discount), 0).mul('0.30').plus(shipping)
  const payNow = mode === 'advance' ? Decimal.min(advancePayNow, total) : total
  return {
    discount: moneyString(loyalty.discount),
    loyaltyPointsUsed: loyalty.pointsUsed,
    payNow: moneyString(payNow),
    remaining: moneyString(total.minus(payNow)),
    shipping: moneyString(shipping),
    subtotal: moneyString(subtotal),
    total: moneyString(total),
  }
}

async function processStripeEvent(event: Stripe.Event) {
  const db = getDatabase()
  if (await db.collection('evenimenteStripe').findOne({ eventId: event.id })) return
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const session = getMongoClient().startSession()
  try {
    await session.withTransaction(async () => {
      if (await db.collection('evenimenteStripe').findOne({ eventId: event.id }, { session })) return
      const payment = await db.collection('plati').findOne({ stripePaymentIntentId: paymentIntent.id }, { session })
      if (payment) {
        const now = new Date()
        const succeeded = event.type === 'payment_intent.succeeded'
        await db.collection('plati').updateOne({ _id: payment._id }, {
          $set: {
            actualizatLa: now,
            statusPlata: succeeded ? 'CONFIRMATA' : 'ESUATA',
            sumaAchitata: succeeded ? payment.sumaDeIncasatAcum : decimal128('0'),
            sumaRamasa: succeeded ? payment.sumaRamasaDupaPlata : payment.sumaTotala,
          },
          $push: {
            tranzactii: {
              creatLa: now,
              metodaPlata: 'CARD',
              referintaProcesator: paymentIntent.id,
              status: succeeded ? 'CONFIRMATA' : 'ESUATA',
              suma: payment.sumaDeIncasatAcum,
              tip: 'PLATA',
              tranzactieId: new ObjectId(),
            } as never,
          },
        }, { session })
        await db.collection('comenzi').updateOne({ _id: payment.comandaId }, {
          $set: { actualizatLa: now, statusComanda: succeeded ? 'PLATITA' : 'IN_ASTEPTARE_PLATA' },
        }, { session })
        const order = await db.collection('comenzi').findOne({ _id: payment.comandaId }, { session })
        if (succeeded) {
          await db.collection('cosuri').updateOne({ _id: order?.cosSursaId }, { $set: { actualizatLa: now, status: 'TRANSFORMAT_IN_COMANDA' } }, { session })
          const configurationIds = order?.linii.map((line: any) => line.configuratie3DId).filter(Boolean) ?? []
          await db.collection('configuratii3D').updateMany({ _id: { $in: configurationIds } }, { $set: { actualizatLa: now, status: 'COMANDATA' } }, { session })
          if (order && order.puncteFidelitateAcordate === undefined) {
            const earnedPoints = calculateLoyaltyPointsEarned(order.total)
            if (earnedPoints > 0) {
              await db.collection('utilizatori').updateOne({ _id: order.userId }, {
                $inc: { puncteFidelitate: earnedPoints },
                $set: { actualizatLa: now },
              }, { session })
            }
            await db.collection('comenzi').updateOne({ _id: order._id }, {
              $set: { actualizatLa: now, puncteFidelitateAcordate: earnedPoints },
            }, { session })
          }
        } else if (order && order.puncteFidelitateFolosite > 0 && order.puncteFidelitateRestaurate !== true) {
          await db.collection('utilizatori').updateOne({ _id: order.userId }, {
            $inc: { puncteFidelitate: order.puncteFidelitateFolosite },
            $set: { actualizatLa: now },
          }, { session })
          await db.collection('comenzi').updateOne({ _id: order._id }, {
            $set: { actualizatLa: now, puncteFidelitateRestaurate: true },
          }, { session })
        }
      }
      await db.collection('evenimenteStripe').insertOne({ creatLa: new Date(), eventId: event.id, tip: event.type }, { session })
    })
  } finally {
    await session.endSession()
  }
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ credentials: true, origin: config.FRONTEND_ORIGIN }))
  app.use(cookieParser())

  app.post('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (request, response) => {
    if (!stripe || !config.STRIPE_WEBHOOK_SECRET) throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured')
    const signature = request.header('stripe-signature')
    if (!signature) throw new AppError(400, 'MISSING_STRIPE_SIGNATURE', 'Stripe signature is missing')
    const event = stripe.webhooks.constructEvent(request.body, signature, config.STRIPE_WEBHOOK_SECRET)
    await processStripeEvent(event)
    response.json({ received: true })
  }))

  app.use(express.json({ limit: '1mb' }))
  app.get('/api/v1/health', (_request, response) => response.json({ status: 'ok' }))
  app.get('/api/v1/public-config', (_request, response) => response.json({
    googleClientId: config.GOOGLE_CLIENT_ID,
    stripePublishableKey: config.STRIPE_PUBLISHABLE_KEY,
  }))

  app.post('/api/v1/auth/register', asyncHandler(async (request, response) => {
    const body = registerSchema.parse(request.body)
    const db = getDatabase()
    if (await db.collection('utilizatori').findOne({ email: body.email })) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account already exists for this email')
    }
    const now = new Date()
    const user = {
      _id: new ObjectId(), actualizatLa: now, creatLa: now, email: body.email,
      nume: body.name, parolaHash: await bcrypt.hash(body.password, 12),
      puncteFidelitate: 0, rol: 'CLIENT', status: 'ACTIV',
    }
    await db.collection('utilizatori').insertOne(user)
    issueSession(response, user._id, 'CLIENT')
    response.status(201).json({ user: userDto(user) })
  }))

  app.post('/api/v1/auth/login', asyncHandler(async (request, response) => {
    const body = loginSchema.parse(request.body)
    const user = await getDatabase().collection('utilizatori').findOne({ email: body.email, status: 'ACTIV' })
    if (!user?.parolaHash || !(await bcrypt.compare(body.password, user.parolaHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
    }
    issueSession(response, user._id, user.rol)
    response.json({ user: userDto(user) })
  }))

  app.post('/api/v1/auth/google', asyncHandler(async (request, response) => {
    if (!config.GOOGLE_CLIENT_ID) throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Autentificarea cu Google nu este configurată')
    const body = googleLoginSchema.parse(request.body)
    const ticket = await googleClient.verifyIdToken({ audience: config.GOOGLE_CLIENT_ID, idToken: body.credential })
    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email || !payload.email_verified) throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google identity is invalid')
    const db = getDatabase()
    const now = new Date()
    let user = await db.collection('utilizatori').findOne({ $or: [{ googleSub: payload.sub }, { email: payload.email.toLowerCase() }] })
    if (user) {
      await db.collection('utilizatori').updateOne({ _id: user._id }, { $set: { actualizatLa: now, googleSub: payload.sub } })
      user = { ...user, googleSub: payload.sub }
    } else {
      user = {
        _id: new ObjectId(), creatLa: now, actualizatLa: now, email: payload.email.toLowerCase(),
        googleSub: payload.sub, nume: payload.name ?? payload.email.split('@')[0],
        puncteFidelitate: 0, rol: 'CLIENT', status: 'ACTIV',
      }
      await db.collection('utilizatori').insertOne(user)
    }
    issueSession(response, user._id, user.rol)
    response.json({ user: userDto(user) })
  }))

  app.post('/api/v1/auth/logout', (_request, response) => { clearSession(response); response.status(204).end() })
  app.get('/api/v1/auth/me', requireAuth, asyncHandler(async (request, response) => {
    const user = await getDatabase().collection('utilizatori').findOne({ _id: request.authUser!.id })
    response.json({ user: userDto(user) })
  }))
  app.patch('/api/v1/users/me', requireAuth, asyncHandler(async (request, response) => {
    const body = profileUpdateSchema.parse(request.body)
    await getDatabase().collection('utilizatori').updateOne({ _id: request.authUser!.id }, { $set: { actualizatLa: new Date(), ...(body.name !== undefined ? { nume: body.name } : {}), ...(body.phone !== undefined ? { telefon: body.phone } : {}) } })
    const user = await getDatabase().collection('utilizatori').findOne({ _id: request.authUser!.id })
    response.json({ user: userDto(user) })
  }))

  app.get('/api/v1/products', asyncHandler(async (request, response) => {
    const db = getDatabase()
    const filter: any = { status: 'ACTIV' }
    if (request.query.category) {
      const categoryNames = ({
        'gaming-chair': ['Scaune', 'Chairs'],
        headset: ['Căști', 'Headsets'],
        keyboard: ['Tastaturi', 'Keyboards'],
        mouse: ['Mouse', 'Mice'],
      } as any)[String(request.query.category)]
      const category = await db.collection('categoriiProduse').findOne({ denumire: { $in: categoryNames ?? [] } })
      filter.categorieId = category?._id ?? null
    }
    const products = await db.collection('produse').find(filter).sort({ denumire: 1 }).toArray()
    const categories = await db.collection('categoriiProduse').find({ _id: { $in: products.map((product) => product.categorieId) } }).toArray()
    response.json({ products: products.map((product) => mapProduct(product, categories.find((category) => category._id.equals(product.categorieId))?.denumire ?? '')) })
  }))
  app.get('/api/v1/products/:slug', asyncHandler(async (request, response) => {
    const { category, product } = await findProductBySlug(routeParam(request.params.slug))
    response.json({ product: mapProduct(product, category?.denumire ?? '') })
  }))
  app.get('/api/v1/products/:slug/customization', asyncHandler(async (request, response) => {
    response.json(await getCustomization(routeParam(request.params.slug)))
  }))
  app.post('/api/v1/products/:slug/customization/quote', asyncHandler(async (request, response) => {
    const body = quoteSchema.parse(request.body)
    const quote = await quoteConfiguration(routeParam(request.params.slug), body.selections)
    response.json({ optionPrice: moneyString(quote.optionPrice), price: moneyString(quote.price) })
  }))

  app.post('/api/v1/configurations', requireAuth, asyncHandler(async (request, response) => {
    const body = saveConfigurationSchema.parse(request.body)
    const session = getMongoClient().startSession()
    let result: any
    try { await session.withTransaction(async () => { result = await createConfiguration(request.authUser!.id, body, 'SALVATA', session) }) }
    finally { await session.endSession() }
    response.status(201).json({ id: result.configurationId.toHexString(), price: moneyString(result.quote.price) })
  }))
  app.post('/api/v1/configuration-sessions/preview', requireAuth, asyncHandler(async (request, response) => {
    const body = saveConfigurationSchema.parse(request.body)
    const session = getMongoClient().startSession()
    let result: any
    try { await session.withTransaction(async () => { result = await createCustomizationSession(request.authUser!.id, body, 'PREVIZUALIZARE', session) }) }
    finally { await session.endSession() }
    response.status(201).json({ id: result.sessionId.toHexString(), price: moneyString(result.quote.price) })
  }))
  app.get('/api/v1/users/me/configurations', requireAuth, asyncHandler(async (request, response) => {
    const configurations = await getDatabase().collection('configuratii3D').find({ userId: request.authUser!.id, status: { $ne: 'INVALIDA' } }).sort({ creatLa: -1 }).limit(100).toArray()
    const products = await getDatabase().collection('produse').find({ _id: { $in: configurations.map((item) => item.produsId) } }).toArray()
    response.json({ configurations: configurations.map((item) => configurationDto(item, products.find((product) => product._id.equals(item.produsId)))) })
  }))
  app.get('/api/v1/users/me/configurations/:id', requireAuth, asyncHandler(async (request, response) => {
    const id = new ObjectId(objectIdSchema.parse(request.params.id))
    const item = await getDatabase().collection('configuratii3D').findOne({ _id: id, userId: request.authUser!.id })
    if (!item) throw new AppError(404, 'CONFIGURATION_NOT_FOUND', 'Configurația nu a fost găsită')
    const product = await getDatabase().collection('produse').findOne({ _id: item.produsId })
    response.json({ configuration: configurationDto(item, product) })
  }))
  app.delete('/api/v1/users/me/configurations/:id', requireAuth, asyncHandler(async (request, response) => {
    const result = await getDatabase().collection('configuratii3D').updateOne({
      _id: new ObjectId(objectIdSchema.parse(request.params.id)),
      userId: request.authUser!.id,
    }, {
      $set: { actualizatLa: new Date(), status: 'INVALIDA' },
    })
    if (!result.matchedCount) throw new AppError(404, 'CONFIGURATION_NOT_FOUND', 'Configurația nu a fost găsită')
    response.status(204).end()
  }))

  app.get('/api/v1/users/me/addresses', requireAuth, asyncHandler(async (request, response) => {
    const addresses = await getDatabase().collection('adrese').find({ userId: request.authUser!.id }).sort({ implicita: -1, creatLa: -1 }).toArray()
    response.json({ addresses: addresses.map(addressDto) })
  }))
  app.post('/api/v1/users/me/addresses', requireAuth, asyncHandler(async (request, response) => {
    const body = addressSchema.parse(request.body)
    const db = getDatabase(); const now = new Date(); const _id = new ObjectId()
    if (body.isDefault) await db.collection('adrese').updateMany({ userId: request.authUser!.id }, { $set: { implicita: false, actualizatLa: now } })
    const document = { _id, actualizatLa: now, codPostal: body.postalCode, creatLa: now, ...(body.label ? { eticheta: body.label } : {}), implicita: body.isDefault, judet: body.county, localitate: body.city, numeFacturare: body.fullName, strada: body.street, tara: body.country, ...(body.phone ? { telefonContact: body.phone } : {}), userId: request.authUser!.id }
    await db.collection('adrese').insertOne(document)
    response.status(201).json({ address: addressDto(document) })
  }))
  app.patch('/api/v1/users/me/addresses/:id', requireAuth, asyncHandler(async (request, response) => {
    const id = new ObjectId(objectIdSchema.parse(request.params.id)); const body = addressUpdateSchema.parse(request.body); const db = getDatabase(); const now = new Date()
    if (body.isDefault) await db.collection('adrese').updateMany({ userId: request.authUser!.id, _id: { $ne: id } }, { $set: { actualizatLa: now, implicita: false } })
    const fields: any = { actualizatLa: now }
    const mapping: any = { city: 'localitate', country: 'tara', county: 'judet', fullName: 'numeFacturare', isDefault: 'implicita', label: 'eticheta', phone: 'telefonContact', postalCode: 'codPostal', street: 'strada' }
    for (const [key, value] of Object.entries(body)) fields[mapping[key]] = value
    const result = await db.collection('adrese').findOneAndUpdate({ _id: id, userId: request.authUser!.id }, { $set: fields }, { returnDocument: 'after' })
    if (!result) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Adresa nu a fost găsită')
    response.json({ address: addressDto(result) })
  }))
  app.delete('/api/v1/users/me/addresses/:id', requireAuth, asyncHandler(async (request, response) => {
    const result = await getDatabase().collection('adrese').deleteOne({ _id: new ObjectId(objectIdSchema.parse(request.params.id)), userId: request.authUser!.id })
    if (!result.deletedCount) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Adresa nu a fost găsită')
    response.status(204).end()
  }))

  app.get('/api/v1/cart', requireAuth, asyncHandler(async (request, response) => { response.json(await cartDto(request.authUser!.id)) }))
  app.post('/api/v1/cart/items', requireAuth, asyncHandler(async (request, response) => {
    const body = addStandardCartItemSchema.parse(request.body); const { product } = await findProductBySlug(body.productSlug)
    if (product.tipProdus === 'PERSONALIZABIL') {
      throw new AppError(400, 'CUSTOMIZATION_REQUIRED', 'Costumizează produsul înainte de a-l adăuga în coș')
    }
    const session = getMongoClient().startSession()
    try { await session.withTransaction(async () => {
      const cart = await activeCart(request.authUser!.id, true, session); const line = cart!.linii.find((item: any) => item.produsId.equals(product._id) && !item.configuratie3DId); const now = new Date()
      if (line) {
        const quantity = line.cantitate + body.quantity
        await getDatabase().collection('cosuri').updateOne({ _id: cart!._id, 'linii.linieId': line.linieId }, { $set: { actualizatLa: now, 'linii.$.cantitate': quantity, 'linii.$.subtotal': decimal128(new Decimal(product.pretBaza.toString()).mul(quantity)) } }, { session })
      } else {
        await getDatabase().collection('cosuri').updateOne({ _id: cart!._id }, { $set: { actualizatLa: now }, $push: { linii: { cantitate: body.quantity, linieId: new ObjectId(), pretUnitate: product.pretBaza, produsId: product._id, subtotal: decimal128(new Decimal(product.pretBaza.toString()).mul(body.quantity)), tipProdus: product.tipProdus } as never } }, { session })
      }
    }) } finally { await session.endSession() }
    response.status(201).json(await cartDto(request.authUser!.id))
  }))
  app.post('/api/v1/cart/items/default-configuration', requireAuth, asyncHandler(async (request, response) => {
    const body = addStandardCartItemSchema.parse(request.body); const session = getMongoClient().startSession()
    try { await session.withTransaction(async () => {
      const selections = await getDefaultConfigurationSelections(body.productSlug, session)
      const created = await createConfiguration(request.authUser!.id, { productSlug: body.productSlug, selections }, 'ADAUGATA_IN_COS', session)
      const cart = await activeCart(request.authUser!.id, true, session); const now = new Date()
      await getDatabase().collection('cosuri').updateOne({ _id: cart!._id }, { $set: { actualizatLa: now }, $push: { linii: { cantitate: body.quantity, configuratie3DId: created.configurationId, linieId: new ObjectId(), pretUnitate: created.quote.price, produsId: created.quote.product._id, subtotal: decimal128(new Decimal(created.quote.price.toString()).mul(body.quantity)), tipProdus: 'PERSONALIZABIL' } as never } }, { session })
    }) } finally { await session.endSession() }
    response.status(201).json(await cartDto(request.authUser!.id))
  }))
  app.post('/api/v1/cart/items/configuration', requireAuth, asyncHandler(async (request, response) => {
    const body = addConfigurationCartItemSchema.parse(request.body); const session = getMongoClient().startSession()
    try { await session.withTransaction(async () => {
      const created = await createConfiguration(request.authUser!.id, body, 'ADAUGATA_IN_COS', session); const cart = await activeCart(request.authUser!.id, true, session); const now = new Date()
      await getDatabase().collection('cosuri').updateOne({ _id: cart!._id }, { $set: { actualizatLa: now }, $push: { linii: { cantitate: body.quantity, configuratie3DId: created.configurationId, linieId: new ObjectId(), pretUnitate: created.quote.price, produsId: created.quote.product._id, subtotal: decimal128(new Decimal(created.quote.price.toString()).mul(body.quantity)), tipProdus: 'PERSONALIZABIL' } as never } }, { session })
    }) } finally { await session.endSession() }
    response.status(201).json(await cartDto(request.authUser!.id))
  }))
  app.patch('/api/v1/cart/items/:id', requireAuth, asyncHandler(async (request, response) => {
    const lineId = new ObjectId(objectIdSchema.parse(request.params.id)); const body = cartItemUpdateSchema.parse(request.body); const cart = await activeCart(request.authUser!.id)
    const line = cart?.linii.find((item: any) => item.linieId.equals(lineId)); if (!cart || !line) throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Produsul din coș nu a fost găsit')
    await getDatabase().collection('cosuri').updateOne({ _id: cart._id, 'linii.linieId': lineId }, { $set: { actualizatLa: new Date(), 'linii.$.cantitate': body.quantity, 'linii.$.subtotal': decimal128(new Decimal(line.pretUnitate.toString()).mul(body.quantity)) } })
    response.json(await cartDto(request.authUser!.id))
  }))
  app.delete('/api/v1/cart/items/:id', requireAuth, asyncHandler(async (request, response) => {
    const cart = await activeCart(request.authUser!.id); if (!cart) throw new AppError(404, 'CART_NOT_FOUND', 'Coșul nu a fost găsit')
    await getDatabase().collection('cosuri').updateOne({ _id: cart._id }, { $set: { actualizatLa: new Date() }, $pull: { linii: { linieId: new ObjectId(objectIdSchema.parse(request.params.id)) } as never } })
    response.json(await cartDto(request.authUser!.id))
  }))

  app.post('/api/v1/checkout/payment-intent', requireAuth, asyncHandler(async (request, response) => {
    if (!stripe) throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured')
    const body = checkoutSchema.parse(request.body); const db = getDatabase(); const cart = await activeCart(request.authUser!.id)
    if (!cart?.linii.length) throw new AppError(400, 'EMPTY_CART', 'Coșul este gol')
    const address = await db.collection('adrese').findOne({ _id: new ObjectId(body.addressId), userId: request.authUser!.id })
    if (!address) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Adresa nu a fost găsită')
    const user = await db.collection('utilizatori').findOne({ _id: request.authUser!.id })
    const products = await db.collection('produse').find({ _id: { $in: cart.linii.map((line: any) => line.produsId) } }).toArray()
    const configurations = await db.collection('configuratii3D').find({ _id: { $in: cart.linii.map((line: any) => line.configuratie3DId).filter(Boolean) } }).toArray()
    const totals = calculateTotals(cart.linii, body.paymentMode, user?.puncteFidelitate ?? 0, body.useLoyaltyPoints); const now = new Date(); const orderId = new ObjectId(); const paymentId = new ObjectId()
    const orderLines = cart.linii.map((line: any) => { const product = products.find((item) => item._id.equals(line.produsId)); const configuration = configurations.find((item) => line.configuratie3DId?.equals(item._id)); return { cantitate: line.cantitate, ...(line.configuratie3DId ? { configuratie3DId: line.configuratie3DId } : {}), ...(configuration ? { configuratieSnapshot: { modelFinalUrl: configuration.modelFinalUrl, pretConfigurare: configuration.pretConfigurare, selectii: configuration.selectiiSnapshot } } : {}), denumireProdus: product?.denumire, linieId: line.linieId, pretUnitate: line.pretUnitate, produsId: line.produsId, sku: product?.sku, subtotal: line.subtotal, tipProdus: line.tipProdus } })
    if (totals.loyaltyPointsUsed > 0) {
      const loyaltyResult = await db.collection('utilizatori').updateOne(
        { _id: request.authUser!.id, puncteFidelitate: { $gte: totals.loyaltyPointsUsed } },
        { $inc: { puncteFidelitate: -totals.loyaltyPointsUsed }, $set: { actualizatLa: now } },
      )
      if (!loyaltyResult.modifiedCount) throw new AppError(409, 'LOYALTY_POINTS_UNAVAILABLE', 'Punctele de fidelitate nu mai sunt disponibile')
    }
    await db.collection('comenzi').insertOne({ _id: orderId, actualizatLa: now, adresaLivrareId: address._id, adresaLivrareSnapshot: { codPostal: address.codPostal, judet: address.judet, localitate: address.localitate, numeFacturare: address.numeFacturare, strada: address.strada, tara: address.tara, telefonContact: address.telefonContact }, costLivrare: decimal128(totals.shipping), cosSursaId: cart._id, creatLa: now, discount: decimal128(totals.discount), linii: orderLines, puncteFidelitateFolosite: totals.loyaltyPointsUsed, statusComanda: 'IN_ASTEPTARE_PLATA', subtotalProduse: decimal128(totals.subtotal), total: decimal128(totals.total), userId: request.authUser!.id })
    const intent = await stripe.paymentIntents.create({ amount: toStripeMinorUnits(totals.payNow), currency: 'ron', metadata: { orderId: orderId.toHexString(), userId: request.authUser!.id.toHexString() }, payment_method_types: ['card'] }, { idempotencyKey: `dimensiongear-${orderId.toHexString()}` })
    await db.collection('plati').insertOne({ _id: paymentId, actualizatLa: now, comandaId: orderId, creatLa: now, metodaPlataInitiala: 'CARD', ...(body.paymentMode === 'advance' ? { metodaPlataRest: 'RAMBURS' } : {}), statusPlata: 'INITIATA', stripePaymentIntentId: intent.id, sumaAchitata: decimal128('0'), sumaDeIncasatAcum: decimal128(totals.payNow), sumaRamasa: decimal128(totals.total), sumaRamasaDupaPlata: decimal128(totals.remaining), sumaTotala: decimal128(totals.total), tipPlata: body.paymentMode === 'advance' ? 'AVANS_PLUS_REST_LA_LIVRARE' : 'INTEGRALA', tranzactii: [] })
    response.status(201).json({ clientSecret: intent.client_secret, orderId: orderId.toHexString(), totals })
  }))
  app.get('/api/v1/orders/:id', requireAuth, asyncHandler(async (request, response) => {
    const order = await getDatabase().collection('comenzi').findOne({ _id: new ObjectId(objectIdSchema.parse(request.params.id)), userId: request.authUser!.id })
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Comanda nu a fost găsită')
    response.json({ order: { createdAt: order.creatLa.toISOString(), id: order._id.toHexString(), status: order.statusComanda, total: moneyString(order.total) } })
  }))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
