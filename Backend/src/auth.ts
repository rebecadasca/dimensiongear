import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { config } from './config.js'
import { AppError } from './errors.js'
import { getDatabase } from './database.js'

export const SESSION_COOKIE = 'dimensiongear_session'

type SessionPayload = { sub: string; role: 'CLIENT' | 'ADMIN' }

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: ObjectId; role: 'CLIENT' | 'ADMIN' }
    }
  }
}

export function issueSession(response: Response, userId: ObjectId, role: 'CLIENT' | 'ADMIN') {
  const token = jwt.sign({ role } satisfies Omit<SessionPayload, 'sub'>, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    subject: userId.toHexString(),
  })
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
  })
}

export function clearSession(response: Response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
  })
}

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE]
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Autentificarea este necesară')
    const payload = jwt.verify(token, config.JWT_SECRET) as SessionPayload
    if (!ObjectId.isValid(payload.sub)) throw new AppError(401, 'INVALID_SESSION', 'Session is invalid')
    const id = new ObjectId(payload.sub)
    const user = await getDatabase().collection('utilizatori').findOne({ _id: id, status: 'ACTIV' })
    if (!user) throw new AppError(401, 'INVALID_SESSION', 'Session is invalid')
    request.authUser = { id, role: user.rol }
    next()
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'INVALID_SESSION', 'Session is invalid'))
  }
}
