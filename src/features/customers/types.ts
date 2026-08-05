import type { OrganizationId } from '../../shared/types'

export interface Customer {
  id: string
  organizationId: OrganizationId
  name: string
  phone?: string
  document?: string
  note?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerInput {
  name: string
  phone?: string
  document?: string
  note?: string
  active?: boolean
}
