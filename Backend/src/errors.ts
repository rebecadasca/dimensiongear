import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export function notFoundHandler(_request: Request, _response: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'))
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = request.header('x-request-id') ?? randomUUID()

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: error.flatten().fieldErrors,
        message: 'The request payload is invalid',
        requestId,
      },
    })
    return
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        details: error.details,
        message: error.message,
        requestId,
      },
    })
    return
  }

  console.error(`[${requestId}]`, error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId },
  })
}
