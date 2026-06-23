import { describe, expect, it } from 'vitest'
import { addressSchema, checkoutSchema, registerSchema } from './validators.js'

describe('public input validation', () => {
  it('normalizes registration emails and rejects weak passwords', () => {
    expect(registerSchema.parse({ email: ' USER@Example.com ', name: 'Demo User', password: 'Secure-pass1!' }).email).toBe('user@example.com')
    expect(() => registerSchema.parse({ email: 'x@example.com', name: 'X', password: '123' })).toThrow()
  })

  it('validates checkout and address contracts', () => {
    expect(checkoutSchema.parse({ addressId: '507f1f77bcf86cd799439011', paymentMode: 'advance' }).paymentMode).toBe('advance')
    expect(() => addressSchema.parse({})).toThrow()
  })
})
