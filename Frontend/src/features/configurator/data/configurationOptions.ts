import type { ColorOption, MaterialOption, ProductPart } from '../types'

export const materialOptions: MaterialOption[] = [
  { id: 'textile', label: 'Textile', priceModifier: 0 },
  { id: 'leather', label: 'Piele', priceModifier: 180 },
  { id: 'mesh', label: 'Mesh', priceModifier: 90 },
]

export const colorOptions: ColorOption[] = [
  {
    id: 'black',
    label: 'Negru',
    hex: '#111827',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'white',
    label: 'Alb',
    hex: '#f9fafb',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'red',
    label: 'Roșu',
    hex: '#dc2626',
    priceModifier: 65,
    inStock: false,
  },
  {
    id: 'orange',
    label: 'Portocaliu',
    hex: '#e27800',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'yellow',
    label: 'Galben',
    hex: '#d6b000',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'green',
    label: 'Verde',
    hex: '#05a907',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'blue',
    label: 'Albastru',
    hex: '#1f7de0',
    priceModifier: 0,
    inStock: true,
  },
  {
    id: 'purple',
    label: 'Mov',
    hex: '#8a12d9',
    priceModifier: 0,
    inStock: true,
  },
]

export const configurableParts: ProductPart[] = [
  { id: 'seat', label: 'Șezut', meshName: 'seat' },
  { id: 'backrest', label: 'Spătar', meshName: 'backrest' },
  { id: 'trim', label: 'Accente', meshName: 'trim' },
]
