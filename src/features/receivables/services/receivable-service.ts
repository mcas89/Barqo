import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId, UserId } from '../../../shared/types'
import type { PaymentMethod } from '../../pos/types'
import {
  RECEIVABLE_STATUS,
  remainingCents,
  statusFromAmounts,
  type CreateReceivableInput,
  type ReceivePaymentInput,
  type Receivable,
  type ReceivablePayment,
  type ReceivableStatus,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function mapReceivable(id: string, data: Record<string, unknown>): Receivable {
  return {
    id,
    organizationId: data.organizationId as string,
    customerId: data.customerId as string,
    customerName: data.customerName as string,
    totalCents: Number(data.totalCents ?? 0),
    paidCents: Number(data.paidCents ?? 0),
    status: (data.status as ReceivableStatus) || RECEIVABLE_STATUS.OPEN,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
    saleId: data.saleId as string | undefined,
    description: data.description as string | undefined,
    dueDate: data.dueDate as string | undefined,
    payments: Array.isArray(data.payments)
      ? (data.payments as ReceivablePayment[])
      : [],
    createdByUserId: data.createdByUserId as string | undefined,
    createdByName: data.createdByName as string | undefined,
  }
}

export async function listReceivables(
  organizationId: OrganizationId,
  options?: { includePaid?: boolean },
): Promise<Receivable[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'receivables')
  const snap = await getDocs(query(col, orderBy('createdAt', 'desc')))
  const list = snap.docs.map((item) => mapReceivable(item.id, item.data()))

  if (options?.includePaid) return list
  return list.filter(
    (item) =>
      item.status === RECEIVABLE_STATUS.OPEN ||
      item.status === RECEIVABLE_STATUS.PARTIAL,
  )
}

export async function getReceivable(
  organizationId: OrganizationId,
  receivableId: string,
): Promise<Receivable | null> {
  const snap = await getDoc(
    doc(requireDb(), 'organizations', organizationId, 'receivables', receivableId),
  )
  if (!snap.exists()) return null
  return mapReceivable(snap.id, snap.data())
}

export async function createReceivable(input: {
  organizationId: OrganizationId
  userId: UserId
  userName: string
  data: CreateReceivableInput
}): Promise<Receivable> {
  const totalCents = Math.round(input.data.totalCents)
  if (totalCents <= 0) throw new Error('Valor do fiado inválido.')
  if (!input.data.customerId || !input.data.customerName.trim()) {
    throw new Error('Selecione o cliente do fiado.')
  }

  const id = createId('rec')
  const now = nowIso()
  const receivable: Receivable = {
    id,
    organizationId: input.organizationId,
    customerId: input.data.customerId,
    customerName: input.data.customerName.trim(),
    totalCents,
    paidCents: 0,
    status: RECEIVABLE_STATUS.OPEN,
    createdAt: now,
    updatedAt: now,
    payments: [],
    createdByUserId: input.userId,
    createdByName: input.userName,
  }

  const description = input.data.description?.trim()
  if (description) receivable.description = description
  if (input.data.saleId) receivable.saleId = input.data.saleId
  if (input.data.dueDate) receivable.dueDate = input.data.dueDate

  await setDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'receivables', id),
    omitUndefined({ ...receivable }),
  )

  return receivable
}

export async function receivePayment(input: {
  organizationId: OrganizationId
  receivableId: string
  userId: UserId
  userName: string
  data: ReceivePaymentInput
}): Promise<Receivable> {
  const existing = await getReceivable(input.organizationId, input.receivableId)
  if (!existing) throw new Error('Conta a receber não encontrada.')
  if (existing.status === RECEIVABLE_STATUS.PAID) {
    throw new Error('Esta conta já está quitada.')
  }
  if (existing.status === RECEIVABLE_STATUS.CANCELED) {
    throw new Error('Conta cancelada.')
  }

  const amount = Math.round(input.data.amountCents)
  if (amount <= 0) throw new Error('Informe o valor recebido.')

  const open = remainingCents(existing)
  if (amount > open) {
    throw new Error(`Valor maior que o saldo em aberto (${open} centavos).`)
  }

  const payment: ReceivablePayment = {
    id: createId('rpay'),
    amountCents: amount,
    method: input.data.method,
    paidAt: nowIso(),
    paidByUserId: input.userId,
    paidByName: input.userName,
  }
  const note = input.data.note?.trim()
  if (note) payment.note = note

  const paidCents = existing.paidCents + amount
  const status = statusFromAmounts(existing.totalCents, paidCents)
  const updatedAt = nowIso()
  const payments = [...existing.payments, payment]

  await updateDoc(
    doc(
      requireDb(),
      'organizations',
      input.organizationId,
      'receivables',
      existing.id,
    ),
    {
      paidCents,
      status,
      payments,
      updatedAt,
    },
  )

  return {
    ...existing,
    paidCents,
    status,
    payments,
    updatedAt,
  }
}

export function filterReceivables(
  items: Receivable[],
  search: string,
): Receivable[] {
  const q = search.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    const haystack = [item.customerName, item.description, item.saleId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function sumOpenCents(items: Receivable[]): number {
  return items.reduce((sum, item) => sum + remainingCents(item), 0)
}

export type { PaymentMethod }
