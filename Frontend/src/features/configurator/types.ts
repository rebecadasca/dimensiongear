export type MaterialOption = {
  id: string
  label: string
  priceModifier: number
}

export type ColorOption = {
  id: string
  label: string
  hex: string
  priceModifier: number
  inStock: boolean
}

export type ProductPart = {
  id: string
  label: string
  meshName: string
}

export type ProductConfiguration = {
  materialId: string
  colorsByPartId: Record<string, string>
}

export type CustomizationOptionValue = {
  available: boolean
  hex?: string
  id: string
  inStock: boolean
  key: string
  label: string
  priceModifier: string
}

export type CustomizationOption = {
  id: string
  key: string
  label: string
  required: boolean
  type: 'color' | 'material' | 'size' | 'variant'
  values: CustomizationOptionValue[]
}

export type CustomizationComponent = {
  id: string
  key: string
  label: string
  options: CustomizationOption[]
}
