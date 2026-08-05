import type { OrganizationId } from '../../shared/types'

export const BARCODE_TYPES = {
  EAN13: 'ean13',
  EAN8: 'ean8',
  CODE128_INTERNAL: 'code128_internal',
  OTHER: 'other',
} as const

export type BarcodeType = (typeof BARCODE_TYPES)[keyof typeof BARCODE_TYPES]

export const BARCODE_SOURCES = {
  MANUFACTURER: 'manufacturer',
  MANUAL: 'manual',
  BALQO_GENERATED: 'balqo_generated',
} as const

export type BarcodeSource = (typeof BARCODE_SOURCES)[keyof typeof BARCODE_SOURCES]

export const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  code128_internal: 'Code 128 interno (BALQO)',
  other: 'Outro',
}

export const BARCODE_SOURCE_LABELS: Record<BarcodeSource, string> = {
  manufacturer: 'Fabricante',
  manual: 'Manual',
  balqo_generated: 'Gerado pelo BALQO',
}

/** Metadados do código — `Product.barcode` continua sendo o valor pesquisável no PDV. */
export interface ProductBarcodeMeta {
  value: string
  type: BarcodeType
  source: BarcodeSource
  generatedAt?: string
  generatedByOperatorId?: string
}

export const PRODUCT_UNITS = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'M'] as const
export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export const PRODUCT_TYPES = {
  PRODUCT: 'product',
  SERVICE: 'service',
} as const

export type ProductType = (typeof PRODUCT_TYPES)[keyof typeof PRODUCT_TYPES]

export interface Product {
  id: string
  organizationId: OrganizationId
  name: string
  /** Código pesquisável no PDV (EAN, interno BALQO ou outro). */
  barcode?: string
  barcodeMeta?: ProductBarcodeMeta
  category?: string
  unit: ProductUnit
  type: ProductType
  priceCents: number
  costCents: number
  stock: number
  minStock: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export function normalizeProductText(value: string): string {
  return value.trim().toLocaleUpperCase('pt-BR')
}

export function formatProductTextInput(value: string): string {
  return value.toLocaleUpperCase('pt-BR')
}

export type ProductInput = {
  name: string
  barcode?: string
  barcodeMeta?: ProductBarcodeMeta
  category?: string
  unit: ProductUnit
  type: ProductType
  priceCents: number
  costCents: number
  stock: number
  minStock: number
  active?: boolean
}
