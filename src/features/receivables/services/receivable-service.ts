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
import {
  addCashMovement,
  getOpenCashSession,
} from '../../cash-register/services/cash-service'
import { CASH_MOVEMENT_TYPES } from '../../cash-register/types'
import { PAYMENT_METHODS, type PaymentMethod } from '../../pos/types'
import {
  RECEIVABLE_STATUS,
  remainingCents,
  statusFromAmounts,
  type CreateReceivableInput,
  type CustomerReceivableAccount,
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
    operatorId: data.operatorId as string | undefined,
    deviceId: data.deviceId as string | undefined,
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
  operatorId: string
  deviceId: string
  /** Id estável (ex.: fiado de venda offline) para retries idempotentes */
  id?: string
  data: CreateReceivableInput
}): Promise<Receivable> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const totalCents = Math.round(input.data.totalCents)
  if (totalCents <= 0) throw new Error('Valor do fiado inválido.')
  if (!input.data.customerId || !input.data.customerName.trim()) {
    throw new Error('Selecione o cliente do fiado.')
  }

  const id = input.id?.trim() || createId('rec')
  if (input.id) {
    const existing = await getReceivable(input.organizationId, id)
    if (existing) return existing
  }

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
    operatorId: input.operatorId,
    deviceId: input.deviceId,
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
  operatorId: string
  deviceId: string
  data: ReceivePaymentInput
  /** Quando o pagamento da conta aplica várias baixas, o caixa lança uma vez só. */
  skipCashMovement?: boolean
}): Promise<Receivable> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

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

  const method = input.data.method
  const isCash = method === PAYMENT_METHODS.CASH && !input.skipCashMovement

  /** Dinheiro na gaveta: exige caixa aberto e vira suprimento. */
  let openCashId: string | null = null
  if (isCash) {
    const cashSession = await getOpenCashSession(input.organizationId)
    if (!cashSession) {
      throw new Error(
        'Abra o caixa para receber fiado em dinheiro. Assim o valor entra na gaveta.',
      )
    }
    openCashId = cashSession.id
  }

  const payment: ReceivablePayment = {
    id: createId('rpay'),
    amountCents: amount,
    method,
    paidAt: nowIso(),
    paidByUserId: input.userId,
    paidByName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
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

  if (isCash && openCashId) {
    try {
      await addCashMovement({
        organizationId: input.organizationId,
        sessionId: openCashId,
        type: CASH_MOVEMENT_TYPES.SUPRIMENTO,
        amountCents: amount,
        reason: `Recebimento fiado — ${existing.customerName}`,
        userId: input.userId,
        userName: input.userName,
        operatorId: input.operatorId,
        deviceId: input.deviceId,
      })
    } catch (err) {
      console.error('Fiado quitado, mas falhou ao lançar no caixa', err)
      throw new Error(
        'Recebimento salvo no fiado, mas não entrou no caixa. Registre um suprimento manual com o mesmo valor ou tente de novo.',
      )
    }
  }

  return {
    ...existing,
    paidCents,
    status,
    payments,
    updatedAt,
  }
}

/** Cancela fiado da venda. Bloqueia se já houve pagamento parcial/total. */
export async function findReceivableBySaleId(
  organizationId: OrganizationId,
  saleId: string,
): Promise<Receivable | null> {
  const stableId = `rec_${saleId}`
  const byId = await getReceivable(organizationId, stableId)
  if (byId) return byId

  const all = await listReceivables(organizationId, { includePaid: true })
  return all.find((item) => item.saleId === saleId) ?? null
}

export function assertReceivableCancellableForSale(receivable: Receivable | null): void {
  if (!receivable) return
  if (receivable.status === RECEIVABLE_STATUS.CANCELED) return
  if (receivable.paidCents > 0 || receivable.status === RECEIVABLE_STATUS.PAID) {
    throw new Error(
      'Este fiado já teve pagamento. Quite ou estorne o recebimento antes de cancelar a venda.',
    )
  }
}

export async function cancelReceivableLinkedToSale(input: {
  organizationId: OrganizationId
  saleId: string
}): Promise<Receivable | null> {
  const receivable = await findReceivableBySaleId(input.organizationId, input.saleId)
  if (!receivable) return null
  if (receivable.status === RECEIVABLE_STATUS.CANCELED) return receivable

  assertReceivableCancellableForSale(receivable)

  const updatedAt = nowIso()
  await updateDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'receivables', receivable.id),
    {
      status: RECEIVABLE_STATUS.CANCELED,
      updatedAt,
    },
  )

  return {
    ...receivable,
    status: RECEIVABLE_STATUS.CANCELED,
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

function lastPaymentAt(item: Receivable): string | undefined {
  let latest: string | undefined
  for (const payment of item.payments) {
    if (!payment.paidAt) continue
    if (!latest || payment.paidAt > latest) latest = payment.paidAt
  }
  return latest
}

function accountStatus(
  openCents: number,
  paidCents: number,
): CustomerReceivableAccount['status'] {
  if (openCents <= 0) return 'paid'
  if (paidCents > 0) return 'partial'
  return 'open'
}

/**
 * Agrupa fiados: 1 card por cliente com saldo;
 * quitados (sem saldo) viram card histórico quando includePaid.
 */
export function buildCustomerAccounts(
  items: Receivable[],
  options?: { includePaid?: boolean },
): CustomerReceivableAccount[] {
  const active = items.filter(
    (item) =>
      item.status === RECEIVABLE_STATUS.OPEN ||
      item.status === RECEIVABLE_STATUS.PARTIAL,
  )
  const paidOnly = items.filter((item) => item.status === RECEIVABLE_STATUS.PAID)

  const openByCustomer = new Map<string, Receivable[]>()
  for (const item of active) {
    const list = openByCustomer.get(item.customerId) ?? []
    list.push(item)
    openByCustomer.set(item.customerId, list)
  }

  const accounts: CustomerReceivableAccount[] = []

  for (const [customerId, charges] of openByCustomer) {
    charges.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const totalCents = charges.reduce((sum, item) => sum + item.totalCents, 0)
    const paidCents = charges.reduce((sum, item) => sum + item.paidCents, 0)
    const openCents = charges.reduce((sum, item) => sum + remainingCents(item), 0)
    let lastPaidAt: string | undefined
    for (const item of charges) {
      const at = lastPaymentAt(item)
      if (at && (!lastPaidAt || at > lastPaidAt)) lastPaidAt = at
    }
    accounts.push({
      customerId,
      customerName: charges[0]?.customerName ?? customerId,
      status: accountStatus(openCents, paidCents),
      totalCents,
      paidCents,
      openCents,
      chargeCount: charges.length,
      charges: charges.map((receivable) => ({
        receivable,
        openCents: remainingCents(receivable),
      })),
      createdAt: charges[0]?.createdAt ?? '',
      updatedAt: charges.reduce(
        (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
        charges[0]?.updatedAt ?? '',
      ),
      lastPaidAt,
    })
  }

  if (options?.includePaid) {
    const paidByCustomer = new Map<string, Receivable[]>()
    for (const item of paidOnly) {
      if (openByCustomer.has(item.customerId)) continue
      const list = paidByCustomer.get(item.customerId) ?? []
      list.push(item)
      paidByCustomer.set(item.customerId, list)
    }

    for (const [customerId, charges] of paidByCustomer) {
      charges.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const totalCents = charges.reduce((sum, item) => sum + item.totalCents, 0)
      const paidCents = charges.reduce((sum, item) => sum + item.paidCents, 0)
      let lastPaidAt: string | undefined
      for (const item of charges) {
        const at = lastPaymentAt(item)
        if (at && (!lastPaidAt || at > lastPaidAt)) lastPaidAt = at
      }
      accounts.push({
        customerId,
        customerName: charges[0]?.customerName ?? customerId,
        status: 'paid',
        totalCents,
        paidCents,
        openCents: 0,
        chargeCount: charges.length,
        charges: charges.map((receivable) => ({
          receivable,
          openCents: 0,
        })),
        createdAt: charges[0]?.createdAt ?? '',
        updatedAt: charges.reduce(
          (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
          charges[0]?.updatedAt ?? '',
        ),
        lastPaidAt,
      })
    }
  }

  accounts.sort((a, b) => {
    if (a.status === 'paid' && b.status !== 'paid') return 1
    if (a.status !== 'paid' && b.status === 'paid') return -1
    return a.customerName.localeCompare(b.customerName, 'pt-BR')
  })
  return accounts
}

export function filterCustomerAccounts(
  accounts: CustomerReceivableAccount[],
  search: string,
): CustomerReceivableAccount[] {
  const q = search.trim().toLowerCase()
  if (!q) return accounts
  return accounts.filter((account) => {
    if (account.customerName.toLowerCase().includes(q)) return true
    return account.charges.some((charge) => {
      const hay = [charge.receivable.description, charge.receivable.saleId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  })
}

/** Baixa FIFO na conta do cliente (vários lançamentos, um recebimento). */
export async function receiveAccountPayment(input: {
  organizationId: OrganizationId
  customerId: string
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  data: ReceivePaymentInput
}): Promise<void> {
  const amount = Math.round(input.data.amountCents)
  if (amount <= 0) throw new Error('Informe o valor recebido.')

  const all = await listReceivables(input.organizationId, { includePaid: false })
  const open = all
    .filter(
      (item) =>
        item.customerId === input.customerId &&
        (item.status === RECEIVABLE_STATUS.OPEN ||
          item.status === RECEIVABLE_STATUS.PARTIAL),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (open.length === 0) throw new Error('Este cliente não tem fiado em aberto.')

  const openTotal = open.reduce((sum, item) => sum + remainingCents(item), 0)
  if (amount > openTotal) {
    throw new Error(`Valor maior que o saldo em aberto (${openTotal} centavos).`)
  }

  const isCash = input.data.method === PAYMENT_METHODS.CASH
  let openCashId: string | null = null
  if (isCash) {
    const cashSession = await getOpenCashSession(input.organizationId)
    if (!cashSession) {
      throw new Error(
        'Abra o caixa para receber fiado em dinheiro. Assim o valor entra na gaveta.',
      )
    }
    openCashId = cashSession.id
  }

  let remaining = amount
  const customerName = open[0]?.customerName ?? 'Cliente'
  for (const item of open) {
    if (remaining <= 0) break
    const slice = Math.min(remainingCents(item), remaining)
    if (slice <= 0) continue
    await receivePayment({
      organizationId: input.organizationId,
      receivableId: item.id,
      userId: input.userId,
      userName: input.userName,
      operatorId: input.operatorId,
      deviceId: input.deviceId,
      data: {
        amountCents: slice,
        method: input.data.method,
        note: input.data.note,
      },
      skipCashMovement: true,
    })
    remaining -= slice
  }

  if (isCash && openCashId) {
    await addCashMovement({
      organizationId: input.organizationId,
      sessionId: openCashId,
      type: CASH_MOVEMENT_TYPES.SUPRIMENTO,
      amountCents: amount,
      reason: `Recebimento fiado — ${customerName}`,
      userId: input.userId,
      userName: input.userName,
      operatorId: input.operatorId,
      deviceId: input.deviceId,
    })
  }
}

export type { PaymentMethod }
