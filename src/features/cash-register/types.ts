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

/** Sync do fechamento (valores locais congelados). */
export const CASH_CLOSING_SYNC_STATUS = {
  LOCAL_PENDING: 'local_pending',
  SYNCING: 'syncing',
  CONFIRMED: 'confirmed',
  REVIEW_REQUIRED: 'review_required',
} as const

export type CashClosingSyncStatus =
  (typeof CASH_CLOSING_SYNC_STATUS)[keyof typeof CASH_CLOSING_SYNC_STATUS]

export const CASH_CLOSING_SYNC_LABELS: Record<CashClosingSyncStatus, string> = {
  local_pending: 'Pendente de sincronização',
  syncing: 'Sincronizando',
  confirmed: 'Sincronizado e confirmado',
  review_required: 'Revisão necessária',
}

export interface CashMovement {
  id: string
  type: CashMovementType
  amountCents: number
  reason?: string
  createdAt: string
  createdByUserId: UserId
  createdByName: string
  /** Operador do PDV que registrou o movimento */
  operatorId: string
  /** Aparelho onde o movimento foi feito */
  deviceId: string
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
  /** Operador do PDV que abriu o caixa */
  openedByOperatorId?: string
  openedDeviceId?: string
  closedAt?: string
  closedByUserId?: UserId
  closedByName?: string
  closedByOperatorId?: string
  closedDeviceId?: string
  movements: CashMovement[]
  /** Totais esperados no fechamento (calculados) */
  expectedByMethod?: PaymentTotals
  expectedCashInDrawerCents?: number
  /** Valores contados pelo operador no fechamento */
  countedByMethod?: PaymentTotals
  countedCashInDrawerCents?: number
  differenceCents?: number
  note?: string
  /** Estado de sync do fechamento (offline). */
  closingSyncStatus?: CashClosingSyncStatus
  /** Congelado no fechamento local — não recalcular no servidor. */
  pendingSalesCountAtClose?: number
  pendingSalesTotalCentsAtClose?: number
  closingSyncError?: string
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
