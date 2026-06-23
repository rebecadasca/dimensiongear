import { Decimal } from 'decimal.js'

export function formatCurrency(amount: string | number) {
  const decimal = new Decimal(amount)
  const fixed = decimal.toDecimalPlaces(0).toFixed(0)
  const formattedInteger = BigInt(fixed).toLocaleString('ro-RO')
  return `${formattedInteger} RON`
}
