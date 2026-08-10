import type { Sale } from '../../features/pos/types'

export interface SaleCreateQueuePayload {
  sale: Sale
  stockDeltas: Array<{
    productId: string
    productName: string
    quantity: number
    /** Baixa de dose em ml (modelo garrafa aberta). */
    consumeMl?: number
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

/** Snapshot congelado do fechamento — servidor grava sem recalcular totais. */
export interface CashCloseQueuePayload {
  session: import('../../features/cash-register/types').CashSession
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
