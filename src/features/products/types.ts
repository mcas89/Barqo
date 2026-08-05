import type { OrganizationId } from '../../shared/types'

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
  barcode?: string
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

export type ProductInput = {
  name: string
  barcode?: string
  category?: string
  unit: ProductUnit
  type: ProductType
  priceCents: number
  costCents: number
  stock: number
  minStock: number
  active?: boolean
}
