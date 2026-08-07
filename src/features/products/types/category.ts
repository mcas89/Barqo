import type { OrganizationId } from '../../shared/types'

export interface ProductCategory {
  id: string
  organizationId: OrganizationId
  name: string
  createdAt: string
  updatedAt: string
}

export type ProductCategoryInput = {
  name: string
}
