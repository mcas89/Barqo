import type { OrganizationId, UserId } from '../../shared/types'
import type { PaymentMethod } from '../pos/types'

export const RECEIVABLE_STATUS = {
  OPEN: 'open',
  PARTIAL: 'partial',
  PAID: 'paid',
  CANCELED: 'canceled',
} as const

export type ReceivableStatus =
  (typeof RECEIVABLE_STATUS)[keyof typeof RECEIVABLE_STATUS]

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  open: 'Em aberto',
  partial: 'Parcial',
  paid: 'Quitado',
  canceled: 'Cancelado',
}

export interface ReceivablePayment {
  id: string
  amountCents: number
  method: PaymentMethod
  paidAt: string
  paidByUserId?: UserId
  paidByName?: string
  operatorId?: string
  deviceId?: string
  note?: string
}

export interface Receivable {
  id: string
  organizationId: OrganizationId
  customerId: string
  customerName: string
  totalCents: number
  paidCents: number
  status: ReceivableStatus
  createdAt: string
  updatedAt: string
  saleId?: string
  description?: string
  dueDate?: string
  payments: ReceivablePayment[]
  createdByUserId?: UserId
  createdByName?: string
  operatorId?: string
  deviceId?: string
}

export interface CreateReceivableInput {
  customerId: string
  customerName: string
  totalCents: number
  description?: string
  saleId?: string
  dueDate?: string
}

export interface ReceivePaymentInput {
  amountCents: number
  method: PaymentMethod
  note?: string
}

/** Linha de cobrança dentro da conta do cliente (um lançamento/venda). */
export interface ReceivableChargeLine {
  receivable: Receivable
  openCents: number
  saleItems?: Array<{ name: string; quantity: number; totalCents: number }>
}

/**
 * Conta de fiado por cliente: um card enquanto houver saldo.
 * Novo card só depois que a conta anterior for 100% quitada.
 */
export interface CustomerReceivableAccount {
  customerId: string
  customerName: string
  status: 'open' | 'partial' | 'paid'
  totalCents: number
  paidCents: number
  openCents: number
  chargeCount: number
  charges: ReceivableChargeLine[]
  createdAt: string
  updatedAt: string
  lastPaidAt?: string
}

export function remainingCents(receivable: Receivable): number {
  return Math.max(0, receivable.totalCents - receivable.paidCents)
}

export function statusFromAmounts(
  totalCents: number,
  paidCents: number,
): ReceivableStatus {
  if (paidCents <= 0) return RECEIVABLE_STATUS.OPEN
  if (paidCents >= totalCents) return RECEIVABLE_STATUS.PAID
  return RECEIVABLE_STATUS.PARTIAL
}
