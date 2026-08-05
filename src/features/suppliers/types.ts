import type { OrganizationId } from '../../shared/types'

export interface Supplier {
  id: string
  organizationId: OrganizationId
  name: string
  contactName?: string
  phone?: string
  document?: string
  category?: string
  note?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierInput {
  name: string
  contactName?: string
  phone?: string
  document?: string
  category?: string
  note?: string
  active?: boolean
}
