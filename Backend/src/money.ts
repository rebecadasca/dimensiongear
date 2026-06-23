import { Decimal } from 'decimal.js'
import { Decimal128 } from 'mongodb'

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP })

export type MoneyString = string

export function decimal128(value: Decimal.Value) {
  return Decimal128.fromString(new Decimal(value).toDecimalPlaces(2).toFixed(2))
}

export function moneyString(value: Decimal128 | Decimal.Value) {
  const raw = value instanceof Decimal128 ? value.toString() : new Decimal(value).toString()
  return new Decimal(raw).toDecimalPlaces(2).toFixed(2)
}

export function sumMoney(values: Array<Decimal128 | Decimal.Value>) {
  let total = new Decimal(0)
  for (const value of values) {
    total = total.plus(value instanceof Decimal128 ? value.toString() : value)
  }
  return total
}

export function toStripeMinorUnits(value: Decimal128 | Decimal.Value) {
  const integer = new Decimal(value instanceof Decimal128 ? value.toString() : value)
    .mul(100)
    .toDecimalPlaces(0)
  if (!integer.isInteger() || integer.isNegative() || integer.greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Stripe amount is outside the supported range')
  }
  return integer.toNumber()
}
