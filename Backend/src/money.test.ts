import { describe, expect, it } from 'vitest'
import { decimal128, moneyString, sumMoney, toStripeMinorUnits } from './money.js'

describe('money helpers', () => {
  it('keeps exact decimal values in Decimal128', () => {
    expect(moneyString(decimal128('1399.99'))).toBe('1399.99')
    expect(moneyString(sumMoney([decimal128('0.10'), decimal128('0.20')]))).toBe('0.30')
  })

  it('converts to Stripe minor units only at the boundary', () => {
    expect(toStripeMinorUnits(decimal128('419.997'))).toBe(42000)
  })
})
