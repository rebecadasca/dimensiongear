import type { Product } from '../../catalog/types'
import { colorOptions, materialOptions } from '../data/configurationOptions'
import type { ProductConfiguration } from '../types'
import { Decimal } from 'decimal.js'

export function calculateConfigurationPrice(
  product: Product,
  configuration: ProductConfiguration,
) {
  const selectedMaterial = materialOptions.find(
    (material) => material.id === configuration.materialId,
  )

  const colorPrice = Object.values(configuration.colorsByPartId).reduce(
    (total, colorId) => {
      const color = colorOptions.find((option) => option.id === colorId)

      return total + (color?.priceModifier ?? 0)
    },
    0,
  )

  return new Decimal(product.pricing.current)
    .plus(selectedMaterial?.priceModifier ?? 0)
    .plus(colorPrice)
    .toFixed(2)
}
