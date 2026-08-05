import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import {
  enqueueOperation,
  getLocalOpenCashSession,
  isOnline,
  listLocalCashSessions,
  listLocalSalesForCashSession,
  listPendingOperations,
  saveLocalCashSession,
  type CashCloseQueuePayload,
  type CashOpenQueuePayload,
} from '../../../infra/offline'
import type { OrganizationId, UserId } from '../../../shared/types'
import type { PaymentMethod, Sale } from '../../pos/types'
import {
  CASH_CLOSING_SYNC_STATUS,
  CASH_MOVEMENT_TYPES,
  CASH_SESSION_STATUS,
  type CashMovement,
  type CashMovementType,
  type CashSession,
  type CashSummary,
  type PaymentTotals,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function emptyTotals(): PaymentTotals {
  return {
    cash: 0,
    pix: 0,
    debit: 0,
    credit: 0,
    on_account: 0,
  }
}

function mapSession(id: string, data: Record<string, unknown>): CashSession {
  return {
    id,
    organizationId: data.organizationId as string,
    status: data.status as CashSession['status'],
    openingAmountCents: Number(data.openingAmountCents ?? 0),
    openedAt: data.openedAt as string,
    openedByUserId: data.openedByUserId as string,
    openedByName: data.openedByName as string,
    openedByOperatorId: data.openedByOperatorId as string | undefined,
    openedDeviceId: data.openedDeviceId as string | undefined,
    closedAt: data.closedAt as string | undefined,
    closedByUserId: data.closedByUserId as string | undefined,
    closedByName: data.closedByName as string | undefined,
    closedByOperatorId: data.closedByOperatorId as string | undefined,
    closedDeviceId: data.closedDeviceId as string | undefined,
    movements: Array.isArray(data.movements) ? (data.movements as CashMovement[]) : [],
    expectedByMethod: data.expectedByMethod as PaymentTotals | undefined,
    expectedCashInDrawerCents:
      data.expectedCashInDrawerCents != null
        ? Number(data.expectedCashInDrawerCents)
        : undefined,
    countedByMethod: data.countedByMethod as PaymentTotals | undefined,
    countedCashInDrawerCents:
      data.countedCashInDrawerCents != null
        ? Number(data.countedCashInDrawerCents)
        : undefined,
    differenceCents:
      data.differenceCents != null ? Number(data.differenceCents) : undefined,
    note: data.note as string | undefined,
    closingSyncStatus: data.closingSyncStatus as CashSession['closingSyncStatus'],
    pendingSalesCountAtClose:
      data.pendingSalesCountAtClose != null
        ? Number(data.pendingSalesCountAtClose)
        : undefined,
    pendingSalesTotalCentsAtClose:
      data.pendingSalesTotalCentsAtClose != null
        ? Number(data.pendingSalesTotalCentsAtClose)
        : undefined,
    closingSyncError: data.closingSyncError as string | undefined,
  }
}

export async function getOpenCashSession(
  organizationId: OrganizationId,
): Promise<CashSession | null> {
  if (!isOnline()) {
    return getLocalOpenCashSession(organizationId)
  }

  try {
    const col = collection(requireDb(), 'organizations', organizationId, 'cash_sessions')
    const snap = await getDocs(
      query(col, where('status', '==', CASH_SESSION_STATUS.OPEN), limit(5)),
    )

    if (snap.empty) {
      return getLocalOpenCashSession(organizationId)
    }

    const sessions = snap.docs
      .map((item) => mapSession(item.id, item.data()))
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))

    const open = sessions[0] ?? null
    if (open) await saveLocalCashSession(open, true).catch(() => undefined)
    return open
  } catch {
    return getLocalOpenCashSession(organizationId)
  }
}

export async function openCashSession(input: {
  organizationId: OrganizationId
  openingAmountCents: number
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
}): Promise<CashSession> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const existing = await getOpenCashSession(input.organizationId)
  if (existing) {
    throw new Error('Já existe um caixa aberto.')
  }

  const id = createId('cash')
  const session: CashSession = {
    id,
    organizationId: input.organizationId,
    status: CASH_SESSION_STATUS.OPEN,
    openingAmountCents: Math.max(0, Math.round(input.openingAmountCents)),
    openedAt: nowIso(),
    openedByUserId: input.userId,
    openedByName: input.userName,
    openedByOperatorId: input.operatorId,
    openedDeviceId: input.deviceId,
    movements: [],
  }

  if (!isOnline()) {
    await saveLocalCashSession(session, false)
    const payload: CashOpenQueuePayload = { session }
    await enqueueOperation(input.organizationId, 'cash.open', payload, {
      id: `cash_${session.id}`,
    })
    return session
  }

  try {
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'cash_sessions', id),
      omitUndefined({ ...session }),
    )
    await saveLocalCashSession(session, true).catch(() => undefined)
    return session
  } catch (err) {
    await saveLocalCashSession(session, false)
    const payload: CashOpenQueuePayload = { session }
    await enqueueOperation(input.organizationId, 'cash.open', payload, {
      id: `cash_${session.id}`,
    })
    console.warn('Caixa aberto offline após falha de rede', err)
    return session
  }
}

export async function addCashMovement(input: {
  organizationId: OrganizationId
  sessionId: string
  type: CashMovementType
  amountCents: number
  reason?: string
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
}): Promise<CashSession> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const ref = doc(
    requireDb(),
    'organizations',
    input.organizationId,
    'cash_sessions',
    input.sessionId,
  )
  const open = await getOpenCashSession(input.organizationId)
  if (!open || open.id !== input.sessionId) {
    throw new Error('Caixa aberto não encontrado.')
  }

  const amount = Math.max(0, Math.round(input.amountCents))
  if (amount <= 0) {
    throw new Error('Informe um valor válido.')
  }

  const movement: CashMovement = {
    id: createId('cmv'),
    type: input.type,
    amountCents: amount,
    createdAt: nowIso(),
    createdByUserId: input.userId,
    createdByName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
  }
  const reason = input.reason?.trim()
  if (reason) movement.reason = reason

  const movements = [...open.movements, movement]
  await updateDoc(ref, { movements })
  return { ...open, movements }
}

export async function listSalesByCashSession(
  organizationId: OrganizationId,
  cashSessionId: string,
): Promise<Sale[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'sales')
  // Sem orderBy para evitar índice composto; ordena no cliente
  const snap = await getDocs(query(col, where('cashSessionId', '==', cashSessionId)))

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Sale)
    .filter((sale) => !sale.status || sale.status === 'completed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function listSalesSince(
  organizationId: OrganizationId,
  fromIso: string,
  toIso?: string,
): Promise<Sale[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'sales')
  // Busca por createdAt >= from; filtro to e status no cliente (evita índice composto)
  const snap = await getDocs(query(col, where('createdAt', '>=', fromIso), orderBy('createdAt', 'asc')))

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Sale)
    .filter((sale) => {
      if (sale.status && sale.status !== 'completed') return false
      if (toIso && sale.createdAt > toIso) return false
      return true
    })
}

export function buildCashSummary(
  session: CashSession,
  sales: Sale[],
): CashSummary {
  const paymentsByMethod = emptyTotals()
  let changeTotalCents = 0
  let salesTotalCents = 0

  for (const sale of sales) {
    salesTotalCents += sale.totalCents ?? 0
    changeTotalCents += sale.changeCents ?? 0
    for (const payment of sale.payments ?? []) {
      const method = payment.method as PaymentMethod
      if (method in paymentsByMethod) {
        paymentsByMethod[method] += payment.amountCents ?? 0
      }
    }
  }

  const sangriaTotalCents = session.movements
    .filter((item) => item.type === CASH_MOVEMENT_TYPES.SANGRIA)
    .reduce((sum, item) => sum + item.amountCents, 0)

  const suprimentoTotalCents = session.movements
    .filter((item) => item.type === CASH_MOVEMENT_TYPES.SUPRIMENTO)
    .reduce((sum, item) => sum + item.amountCents, 0)

  const expectedCashInDrawerCents =
    session.openingAmountCents +
    paymentsByMethod.cash -
    changeTotalCents +
    suprimentoTotalCents -
    sangriaTotalCents

  return {
    salesCount: sales.length,
    salesTotalCents,
    paymentsByMethod,
    changeTotalCents,
    sangriaTotalCents,
    suprimentoTotalCents,
    expectedCashInDrawerCents,
  }
}

export async function listRecentCashSessions(
  organizationId: OrganizationId,
  max = 8,
): Promise<CashSession[]> {
  const local = await listLocalCashSessions(organizationId, { max: max * 2 }).catch(
    () => [] as CashSession[],
  )

  if (!isOnline()) {
    return local
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .slice(0, max)
  }

  try {
    const col = collection(requireDb(), 'organizations', organizationId, 'cash_sessions')
    const snap = await getDocs(query(col, orderBy('openedAt', 'desc'), limit(max)))
    const remote = snap.docs.map((item) => mapSession(item.id, item.data()))
    const merged = new Map<string, CashSession>()
    for (const session of [...remote, ...local]) {
      const prev = merged.get(session.id)
      if (!prev) {
        merged.set(session.id, session)
        continue
      }
      if (
        session.closingSyncStatus &&
        session.closingSyncStatus !== CASH_CLOSING_SYNC_STATUS.CONFIRMED
      ) {
        merged.set(session.id, { ...prev, ...session })
      } else {
        merged.set(session.id, { ...prev, ...session })
      }
    }
    return Array.from(merged.values())
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .slice(0, max)
  } catch {
    return local.slice(0, max)
  }
}

async function collectSessionSales(
  organizationId: OrganizationId,
  session: CashSession,
  closedAt: string,
): Promise<Sale[]> {
  const merged = new Map<string, Sale>()

  const localSales = await listLocalSalesForCashSession(organizationId, session.id).catch(
    () => [] as Sale[],
  )
  for (const sale of localSales) merged.set(sale.id, sale)

  if (isOnline()) {
    try {
      const [bySession, sinceOpen] = await Promise.all([
        listSalesByCashSession(organizationId, session.id),
        listSalesSince(organizationId, session.openedAt, closedAt),
      ])
      for (const sale of [...sinceOpen, ...bySession]) {
        if (!sale.cashSessionId || sale.cashSessionId === session.id) {
          merged.set(sale.id, sale)
        }
      }
    } catch {
      // mantém só locais
    }
  }

  return Array.from(merged.values())
}

async function countPendingForSession(
  organizationId: OrganizationId,
  sessionId: string,
): Promise<{ count: number; totalCents: number }> {
  const pendingSales = await listLocalSalesForCashSession(organizationId, sessionId, {
    pendingOnly: true,
  }).catch(() => [] as Sale[])

  const byId = new Map<string, Sale>()
  for (const sale of pendingSales) byId.set(sale.id, sale)

  const queue = await listPendingOperations(organizationId).catch(() => [])
  for (const item of queue) {
    if (item.operation !== 'sale.create') continue
    const payload = item.payload as { sale?: Sale }
    if (payload?.sale?.cashSessionId === sessionId && payload.sale.id) {
      byId.set(payload.sale.id, payload.sale)
    }
  }

  const list = Array.from(byId.values())
  const totalCents = list.reduce((sum, s) => sum + (s.totalCents ?? 0), 0)
  return { count: list.length, totalCents }
}

export async function closeCashSession(input: {
  organizationId: OrganizationId
  sessionId: string
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  countedCashInDrawerCents: number
  note?: string
}): Promise<CashSession> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const open = await getOpenCashSession(input.organizationId)
  if (!open || open.id !== input.sessionId) {
    throw new Error('Caixa aberto não encontrado.')
  }

  const closedAt = nowIso()
  const sales = await collectSessionSales(input.organizationId, open, closedAt)
  const summary = buildCashSummary(open, sales)
  const pending = await countPendingForSession(input.organizationId, open.id)

  const countedCash = Math.max(0, Math.round(input.countedCashInDrawerCents))
  const differenceCents = countedCash - summary.expectedCashInDrawerCents

  const expectedByMethod: PaymentTotals = { ...summary.paymentsByMethod }
  const countedByMethod: PaymentTotals = {
    ...emptyTotals(),
    cash: countedCash,
    pix: summary.paymentsByMethod.pix,
    debit: summary.paymentsByMethod.debit,
    credit: summary.paymentsByMethod.credit,
    on_account: summary.paymentsByMethod.on_account,
  }

  const hasPending = pending.count > 0
  const closingSyncStatus = hasPending
    ? CASH_CLOSING_SYNC_STATUS.LOCAL_PENDING
    : CASH_CLOSING_SYNC_STATUS.CONFIRMED

  const closed: CashSession = {
    ...open,
    status: CASH_SESSION_STATUS.CLOSED,
    closedAt,
    closedByUserId: input.userId,
    closedByName: input.userName,
    closedByOperatorId: input.operatorId,
    closedDeviceId: input.deviceId,
    expectedByMethod,
    expectedCashInDrawerCents: summary.expectedCashInDrawerCents,
    countedByMethod,
    countedCashInDrawerCents: countedCash,
    differenceCents,
    note: input.note?.trim() || undefined,
    closingSyncStatus,
    pendingSalesCountAtClose: pending.count,
    pendingSalesTotalCentsAtClose: pending.totalCents,
  }

  const persistLocalAndQueue = async (session: CashSession) => {
    await saveLocalCashSession(session, false)
    const payload: CashCloseQueuePayload = { session }
    await enqueueOperation(input.organizationId, 'cash.close', payload, {
      id: `cashclose_${session.id}`,
    })
  }

  if (!isOnline()) {
    const pendingClose: CashSession = {
      ...closed,
      closingSyncStatus: CASH_CLOSING_SYNC_STATUS.LOCAL_PENDING,
    }
    await persistLocalAndQueue(pendingClose)
    return pendingClose
  }

  try {
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'cash_sessions', closed.id),
      omitUndefined({ ...closed }),
      { merge: true },
    )
    await saveLocalCashSession(closed, !hasPending)
    if (hasPending) {
      const payload: CashCloseQueuePayload = { session: closed }
      await enqueueOperation(input.organizationId, 'cash.close', payload, {
        id: `cashclose_${closed.id}`,
      })
    }
    return closed
  } catch (err) {
    console.warn('Fechamento enfileirado após falha de rede', err)
    const pendingClose: CashSession = {
      ...closed,
      closingSyncStatus: CASH_CLOSING_SYNC_STATUS.LOCAL_PENDING,
    }
    await persistLocalAndQueue(pendingClose)
    return pendingClose
  }
}

/** Aplica fechamento enfileirado — grava snapshot congelado, sem recalcular. */
export async function applyQueuedCashClose(
  organizationId: string,
  payload: CashCloseQueuePayload,
): Promise<void> {
  const session = payload.session
  const confirmed: CashSession = {
    ...session,
    status: CASH_SESSION_STATUS.CLOSED,
    closingSyncStatus: CASH_CLOSING_SYNC_STATUS.CONFIRMED,
  }
  delete (confirmed as { closingSyncError?: string }).closingSyncError

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'cash_sessions', session.id),
    omitUndefined({ ...confirmed }),
    { merge: true },
  )
  await saveLocalCashSession(confirmed, true)
}

export async function markCashCloseReviewRequired(
  organizationId: string,
  sessionId: string,
  errorMessage: string,
): Promise<void> {
  const { updateLocalCashSessionFields } = await import('../../../infra/offline')
  const patch = {
    closingSyncStatus: CASH_CLOSING_SYNC_STATUS.REVIEW_REQUIRED,
    closingSyncError: errorMessage,
  }
  try {
    if (isOnline()) {
      await updateDoc(
        doc(requireDb(), 'organizations', organizationId, 'cash_sessions', sessionId),
        patch,
      )
    }
  } catch {
    // local only
  }
  await updateLocalCashSessionFields(sessionId, patch, false).catch(() => undefined)
}

export { emptyTotals }
