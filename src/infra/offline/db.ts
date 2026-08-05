import Dexie, { type EntityTable } from 'dexie'
import type { ProductType, ProductUnit } from '../../features/products/types'
import type { Sale } from '../../features/pos/types'
import type { CashSession } from '../../features/cash-register/types'

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

/** Cache completo do produto para vender offline. */
export interface CachedProduct {
  id: string
  organizationId: string
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

export interface CachedCustomer {
  id: string
  organizationId: string
  name: string
  document?: string
  updatedAt: string
}

export interface LocalSaleRecord {
  id: string
  organizationId: string
  createdAt: string
  synced: boolean
  sale: Sale
}

export interface LocalCashSessionRecord {
  id: string
  organizationId: string
  status: 'open' | 'closed'
  synced: boolean
  session: CashSession
  updatedAt: string
}

export interface DeviceMetaRow {
  key: string
  value: string
}

export interface DeviceLeaseRow {
  organizationId: string
  lease: import('../../features/devices/types').DeviceLease
  updatedAt: string
}

export interface SubscriptionLeaseRow {
  organizationId: string
  lease: import('../../features/devices/types').LocalSubscriptionLease
  updatedAt: string
}

export class BalqoLocalDb extends Dexie {
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  products!: EntityTable<CachedProduct, 'id'>
  customers!: EntityTable<CachedCustomer, 'id'>
  localSales!: EntityTable<LocalSaleRecord, 'id'>
  cashSessions!: EntityTable<LocalCashSessionRecord, 'id'>
  deviceMeta!: EntityTable<DeviceMetaRow, 'key'>
  deviceLeases!: EntityTable<DeviceLeaseRow, 'organizationId'>
  subscriptionLeases!: EntityTable<SubscriptionLeaseRow, 'organizationId'>

  constructor() {
    super('balqo_local')

    this.version(1).stores({
      syncQueue: 'id, organizationId, createdAt, operation',
      products: 'id, organizationId, barcode, name, updatedAt',
      customers: 'id, organizationId, name, updatedAt',
    })

    this.version(2).stores({
      syncQueue: 'id, organizationId, createdAt, operation',
      products: 'id, organizationId, barcode, name, updatedAt, active',
      customers: 'id, organizationId, name, updatedAt',
      localSales: 'id, organizationId, createdAt, synced',
      cashSessions: 'id, organizationId, status, synced, updatedAt',
    })

    this.version(3).stores({
      syncQueue: 'id, organizationId, createdAt, operation',
      products: 'id, organizationId, barcode, name, updatedAt, active',
      customers: 'id, organizationId, name, updatedAt',
      localSales: 'id, organizationId, createdAt, synced',
      cashSessions: 'id, organizationId, status, synced, updatedAt',
      deviceMeta: 'key',
      deviceLeases: 'organizationId, updatedAt',
      subscriptionLeases: 'organizationId, updatedAt',
    })
  }
}

export const localDb = new BalqoLocalDb()
