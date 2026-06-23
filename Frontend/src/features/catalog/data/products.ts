/* Catalog data is loaded from MongoDB through the API. */
import type { Product } from '../types'

export const products: Product[] = []

export function getProductById() {
  return undefined as Product | undefined
}
