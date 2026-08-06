import type { OrganizationId, UserId } from '../../shared/types'

export const STOCK_MOVEMENT_TYPES = {
  SALE: 'sale',
  SALE_RETURN: 'sale_return',
  ENTRY: 'entry',
  ADJUSTMENT: 'adjustment',
  LOSS: 'loss',
} as const

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPES)[keyof typeof STOCK_MOVEMENT_TYPES]

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  sale: 'Venda',
  sale_return: 'Devolução / cancelamento',
  entry: 'Entrada',
  adjustment: 'Ajuste',
  loss: 'Perda / saída',
}

export interface StockMovement {
  id: string
  organizationId: OrganizationId
  productId: string
  productName: string
  type: StockMovementType
  /** Positivo = entrada; negativo = saída */
  quantity: number
  stockBefore: number
  stockAfter: number
  createdAt: string
  createdByUserId?: UserId
  createdByName?: string
  operatorId?: string
  deviceId?: string
  note?: string
  saleId?: string
}

export interface StockEntryInput {
  productId: string
  quantity: number
  note?: string
}

export interface StockAdjustmentInput {
  productId: string
  /** Novo saldo contado */
  newStock: number
  note?: string
}

export interface StockLossInput {
  productId: string
  quantity: number
  note?: string
}
