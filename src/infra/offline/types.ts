import type { Sale } from '../../features/pos/types'

export interface SaleCreateQueuePayload {
  sale: Sale
  stockDeltas: Array<{
    productId: string
    productName: string
    quantity: number
  }>
  receivable?: {
    customerId: string
    customerName: string
    totalCents: number
    description: string
  }
}

export interface CashOpenQueuePayload {
  session: import('../../features/cash-register/types').CashSession
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
