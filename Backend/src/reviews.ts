import { ObjectId, type ClientSession } from 'mongodb'
import { AppError } from './errors.js'
import { getDatabase } from './database.js'
import { findProductBySlug } from './catalog.js'

type ReviewInput = {
  rating: number
  text: string
}

type ReplyInput = {
  text: string
}

function replyDto(reply: any) {
  return {
    authorName: reply.numeUtilizatorSnapshot,
    createdAt: reply.creatLa.toISOString(),
    id: reply.raspunsId.toHexString(),
    text: reply.text,
  }
}

export function reviewDto(review: any) {
  return {
    authorName: review.numeUtilizatorSnapshot,
    createdAt: review.creatLa.toISOString(),
    id: review._id.toHexString(),
    rating: review.rating,
    replies: (review.raspunsuri ?? []).map(replyDto),
    text: review.text,
    updatedAt: review.actualizatLa.toISOString(),
  }
}

export async function listProductReviews(slug: string, limit?: number) {
  const { product } = await findProductBySlug(slug)
  const safeLimit = limit ? Math.min(Math.max(limit, 1), 100) : 100
  const reviews = await getDatabase()
    .collection('recenziiProduse')
    .find({ produsId: product._id })
    .sort({ creatLa: -1 })
    .limit(safeLimit)
    .toArray()

  return {
    productId: product.slug,
    rating: product.rating ?? 0,
    reviewCount: product.numarReviewuri ?? 0,
    reviews: reviews.map(reviewDto),
  }
}

export async function refreshProductReviewStats(productId: ObjectId, session?: ClientSession) {
  const db = getDatabase()
  const [stats] = await db.collection('recenziiProduse')
    .aggregate([
      { $match: { produsId: productId } },
      {
        $group: {
          _id: '$produsId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ], { session })
    .toArray()

  const rating = stats ? Math.round(Number(stats.averageRating) * 100) / 100 : 0
  const reviewCount = stats ? Number(stats.reviewCount) : 0

  await db.collection('produse').updateOne(
    { _id: productId },
    {
      $set: {
        actualizatLa: new Date(),
        numarReviewuri: reviewCount,
        rating,
      },
    },
    { session },
  )

  return { rating, reviewCount }
}

export async function upsertProductReview(slug: string, userId: ObjectId, input: ReviewInput) {
  const db = getDatabase()
  const { product } = await findProductBySlug(slug)
  const user = await db.collection('utilizatori').findOne({ _id: userId })
  if (!user) throw new AppError(401, 'INVALID_SESSION', 'Session is invalid')

  const now = new Date()
  await db.collection('recenziiProduse').updateOne(
    { produsId: product._id, userId },
    {
      $set: {
        actualizatLa: now,
        numeUtilizatorSnapshot: user.nume,
        rating: input.rating,
        text: input.text,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        creatLa: now,
        produsId: product._id,
        raspunsuri: [],
        userId,
      },
    },
    { upsert: true },
  )

  await refreshProductReviewStats(product._id)
  const review = await db.collection('recenziiProduse').findOne({ produsId: product._id, userId })
  return reviewDto(review)
}

export async function addReviewReply(slug: string, reviewId: ObjectId, userId: ObjectId, input: ReplyInput) {
  const db = getDatabase()
  const { product } = await findProductBySlug(slug)
  const user = await db.collection('utilizatori').findOne({ _id: userId })
  if (!user) throw new AppError(401, 'INVALID_SESSION', 'Session is invalid')

  const reply = {
    creatLa: new Date(),
    numeUtilizatorSnapshot: user.nume,
    raspunsId: new ObjectId(),
    text: input.text,
    userId,
  }
  const result = await db.collection('recenziiProduse').updateOne(
    { _id: reviewId, produsId: product._id },
    {
      $push: { raspunsuri: reply as never },
      $set: { actualizatLa: new Date() },
    },
  )

  if (!result.matchedCount) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Recenzia nu a fost gasita')
  }

  const review = await db.collection('recenziiProduse').findOne({ _id: reviewId })
  return reviewDto(review)
}
