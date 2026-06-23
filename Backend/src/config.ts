import 'dotenv/config'
import { z } from 'zod'

const environmentSchema = z.object({
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-me-123456'),
  MONGODB_DB_NAME: z.string().min(1).default('dimensiongear_db'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
})

export const config = environmentSchema.parse(process.env)
