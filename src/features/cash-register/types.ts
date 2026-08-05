import type { OrganizationId, UserId } from '../../shared/types'
import type { PaymentMethod } from '../pos/types'

export const CASH_MOVEMENT_TYPES = {
  SANGRIA: 'sangria',
  SUPRIMENTO: 'suprimento',
} as const

export type CashMovementType =
  (typeof CASH_MOVEMENT_TYPES)[keyof typeof CASH_MOVEMENT_TYPES]

export const CASH_SESSION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const

export type CashSessionStatus =
  (typeof CASH_SESSION_STATUS)[keyof typeof CASH_SESSION_STATUS]

export interface CashMovement {
  id: string
  type: CashMovementType
  amountCents: number
  reason?: string
  createdAt: string
  createdByUserId: UserId
  createdByName: string
}

export type PaymentTotals = Record<PaymentMethod, number>

export interface CashSession {
  id: string
  organizationId: OrganizationId
  status: CashSessionStatus
  openingAmountCents: number
  openedAt: string
  openedByUserId: UserId
  openedByName: string
  closedAt?: string
  closedByUserId?: UserId
  closedByName?: string
  movements: CashMovement[]
  /** Totais esperados no fechamento (calculados) */
  expectedByMethod?: PaymentTotals
  expectedCashInDrawerCents?: number
  /** Valores contados pelo operador no fechamento */
  countedByMethod?: PaymentTotals
  countedCashInDrawerCents?: number
  differenceCents?: number
  note?: string
}

export interface CashSummary {
  salesCount: number
  salesTotalCents: number
  paymentsByMethod: PaymentTotals
  changeTotalCents: number
  sangriaTotalCents: number
  suprimentoTotalCents: number
  /** Dinheiro esperado na gaveta */
  expectedCashInDrawerCents: number
}
