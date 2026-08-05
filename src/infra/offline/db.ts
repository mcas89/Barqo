import Dexie, { type EntityTable } from 'dexie'

export type QueueOperation =
  | 'sale.create'
  | 'sale.cancel'
  | 'cash.open'
  | 'cash.close'
  | 'cash.movement'
  | 'stock.adjust'
  | 'product.upsert'
  | 'customer.upsert'

export interface SyncQueueItem {
  id: string
  organizationId: string
  operation: QueueOperation
  payload: unknown
  createdAt: string
  attempts: number
  lastError?: string
}

export interface CachedProduct {
  id: string
  organizationId: string
  name: string
  barcode?: string
  priceCents: number
  stock?: number
  updatedAt: string
}

export interface CachedCustomer {
  id: string
  organizationId: string
  name: string
  document?: string
  updatedAt: string
}

export class BalqoLocalDb extends Dexie {
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  products!: EntityTable<CachedProduct, 'id'>
  customers!: EntityTable<CachedCustomer, 'id'>

  constructor() {
    super('balqo_local')

    this.version(1).stores({
      syncQueue: 'id, organizationId, createdAt, operation',
      products: 'id, organizationId, barcode, name, updatedAt',
      customers: 'id, organizationId, name, updatedAt',
    })
  }
}

export const localDb = new BalqoLocalDb()
