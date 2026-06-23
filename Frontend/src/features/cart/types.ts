export type CartPaymentMode = 'full' | 'advance'

export type CartItem = {
  configurationId?: string
  id: string
  imageSrc?: string
  productCategory?: string
  productId: string
  productName: string
  quantity: number
  subtotal: string
  unitPrice: string
  variantName: string
}

export type CartTotals = {
  discount: string
  loyaltyPointsUsed: number
  payNow: string
  remaining: string
  shipping: string
  subtotal: string
  total: string
}

export type ConfigurationSelectionInput = {
  componentId: string
  optionId: string
  valueId: string
}
