import type { Product } from './types'

const cardImageOverrides: Record<string, string> = {
  'logitech-mx-master-3s-pale-gray': 'image-01',
  'nova-s6-air-3d-custom-wireless': 'image-03',
  'skullcandy-crusher-custom': 'image-04',
}

export function getProductCardImage(product: Product) {
  const preferredImageId = cardImageOverrides[product.id]

  return (
    product.gallery.find((image) => image.id === preferredImageId) ??
    product.gallery.find((image) => image.isPrimary) ??
    product.gallery[0]
  )
}
