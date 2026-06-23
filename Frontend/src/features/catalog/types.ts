export type ProductCategory = 'gaming-chair' | 'headset' | 'keyboard' | 'mouse'

export type ProductType = 'classic' | 'customizable'

export type ProductStatus = 'active' | 'inactive' | 'unavailable'

export type ProductCurrency = 'RON'

export type ProductGalleryImage = {
  id: string
  label: string
  src: string
  alt: string
  colorId?: string
  isPrimary?: boolean
}

export type ProductColor = {
  id: string
  label: string
  hex: string
  inStock: boolean
  priceOverride?: string
}

export type ProductPricing = {
  current: string
  previous?: string
  currency: ProductCurrency
}

export type ProductDescription = {
  short: string
  long: string
}

export type ProductCustomization = {
  model3DUrl: string
  estimatedProductionDays: number
  startingPrice?: string
  maxEstimatedPrice?: string
}

export type Product = {
  id: string
  databaseId: string
  sku: string
  name: string
  category: ProductCategory
  productType: ProductType
  status: ProductStatus
  pricing: ProductPricing
  rating: number
  reviewCount: number
  description: ProductDescription
  gallery: ProductGalleryImage[]
  colors: ProductColor[]
  tags: string[]
  specifications: Record<string, string | number | boolean | null>
  customization?: ProductCustomization
}
