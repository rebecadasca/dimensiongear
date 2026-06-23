import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')
const strongPasswordSchema = z.string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number')
  .regex(/[!?*@$]/, 'Password must include a special character')

export const registerSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(100),
  password: strongPasswordSchema,
})

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
})

export const googleLoginSchema = z.object({ credential: z.string().min(20) })

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
}).refine((value) => value.name !== undefined || value.phone !== undefined, 'No changes supplied')

export const addressSchema = z.object({
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  county: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(2).max(120),
  isDefault: z.boolean().default(false),
  label: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  postalCode: z.string().trim().min(2).max(20),
  street: z.string().trim().min(2).max(200),
})

export const addressUpdateSchema = addressSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'No changes supplied',
)

export const selectionSchema = z.object({
  componentId: objectIdSchema,
  optionId: objectIdSchema,
  valueId: objectIdSchema,
})

export const quoteSchema = z.object({ selections: z.array(selectionSchema).min(1).max(100) })

export const saveConfigurationSchema = quoteSchema.extend({
  productSlug: z.string().trim().min(1),
  sourceConfigurationId: objectIdSchema.optional(),
})

export const addStandardCartItemSchema = z.object({
  productSlug: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
})

export const addConfigurationCartItemSchema = saveConfigurationSchema.extend({
  quantity: z.number().int().min(1).max(99).default(1),
})

export const cartItemUpdateSchema = z.object({ quantity: z.number().int().min(1).max(99) })

export const checkoutSchema = z.object({
  addressId: objectIdSchema,
  paymentMode: z.enum(['full', 'advance']),
  useLoyaltyPoints: z.boolean().default(false),
})
