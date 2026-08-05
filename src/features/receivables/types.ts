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
