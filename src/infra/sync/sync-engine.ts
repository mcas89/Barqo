import { isFirebaseConfigured } from '../firebase'
import {
  countPendingOperations,
  listPendingOperations,
  markQueueError,
  removeQueueItem,
  type CashCloseQueuePayload,
  type CashOpenQueuePayload,
  type SaleCreateQueuePayload,
  markLocalCashSynced,
  markLocalSaleSynced,
  saveLocalCashSession,
} from '../offline'
import { setSyncStatus } from './status'
import { SYNC_STATUS } from '../../shared/constants'
import { doc, setDoc } from 'firebase/firestore'
import { getFirestoreDb } from '../firebase'
import { omitUndefined } from '../../shared/lib/firestore'

const MAX_ATTEMPTS = 8
const PROCESSABLE = new Set(['sale.create', 'cash.open', 'cash.close'])

let syncRunning = false
let syncTimer: number | null = null

function operationPriority(operation: string): number {
  if (operation === 'cash.open') return 0
  if (operation === 'sale.create') return 1
  if (operation === 'cash.close') return 2
  return 9
}

/**
 * Processa a fila local → Firestore.
 * Ordem: cash.open → sale.create → cash.close.
 */
export async function runSyncPass(organizationId?: string): Promise<{ pending: number; synced: number }> {
  const pending = await listPendingOperations(organizationId)
  const ordered = [...pending].sort((a, b) => {
    const byOp = operationPriority(a.operation) - operationPriority(b.operation)
    if (byOp !== 0) return byOp
    return a.createdAt.localeCompare(b.createdAt)
  })

  if (!navigator.onLine) {
    setSyncStatus(SYNC_STATUS.OFFLINE)
    return { pending: pending.length, synced: 0 }
  }

  if (!isFirebaseConfigured()) {
    setSyncStatus(SYNC_STATUS.ONLINE)
    return { pending: pending.length, synced: 0 }
  }

  const processable = ordered.filter((item) => PROCESSABLE.has(item.operation))
  if (processable.length === 0) {
    setSyncStatus(SYNC_STATUS.ONLINE)
    return { pending: pending.length, synced: 0 }
  }

  if (syncRunning) {
    return { pending: pending.length, synced: 0 }
  }

  syncRunning = true
  setSyncStatus(SYNC_STATUS.SYNCING)
  let synced = 0

  try {
    for (const item of ordered) {
      if (!PROCESSABLE.has(item.operation)) continue
      if (item.attempts >= MAX_ATTEMPTS) {
        if (item.operation === 'cash.close') {
          const payload = item.payload as CashCloseQueuePayload
          const { markCashCloseReviewRequired } = await import(
            '../../features/cash-register/services/cash-service'
          )
          await markCashCloseReviewRequired(
            item.organizationId,
            payload.session.id,
            item.lastError || 'Falha após várias tentativas de sincronização',
          ).catch(() => undefined)
        }
        continue
      }

      try {
        if (item.operation === 'sale.create') {
          const { applyQueuedSaleCreate } = await import(
            '../../features/pos/services/sale-service'
          )
          await applyQueuedSaleCreate(
            item.organizationId,
            item.payload as SaleCreateQueuePayload,
          )
          await markLocalSaleSynced((item.payload as SaleCreateQueuePayload).sale.id)
        } else if (item.operation === 'cash.open') {
          const payload = item.payload as CashOpenQueuePayload
          const db = getFirestoreDb()
          if (!db) throw new Error('Firestore indisponível')
          await setDoc(
            doc(db, 'organizations', item.organizationId, 'cash_sessions', payload.session.id),
            omitUndefined({ ...payload.session }),
            { merge: true },
          )
          await markLocalCashSynced(payload.session.id)
          await saveLocalCashSession(payload.session, true)
        } else if (item.operation === 'cash.close') {
          const { applyQueuedCashClose } = await import(
            '../../features/cash-register/services/cash-service'
          )
          await applyQueuedCashClose(
            item.organizationId,
            item.payload as CashCloseQueuePayload,
          )
        }

        await removeQueueItem(item.id)
        synced += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao sincronizar'
        await markQueueError(item.id, message)
        console.error('Sync item failed', item.id, err)
      }
    }

    const leftItems = await listPendingOperations(organizationId)
    const leftProcessable = leftItems.filter((item) => PROCESSABLE.has(item.operation))
    const hasErrors = leftProcessable.some((item) => Boolean(item.lastError) || item.attempts > 0)
    setSyncStatus(
      leftProcessable.length === 0
        ? SYNC_STATUS.ONLINE
        : hasErrors
          ? SYNC_STATUS.ERROR
          : SYNC_STATUS.ONLINE,
    )
    return { pending: leftItems.length, synced }
  } finally {
    syncRunning = false
  }
}

/** Agenda sync (debounce) — seguro chamar várias vezes. */
export function requestSyncPass(organizationId?: string) {
  if (typeof window === 'undefined') return
  if (!navigator.onLine) {
    setSyncStatus(SYNC_STATUS.OFFLINE)
    return
  }
  if (syncTimer != null) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void runSyncPass(organizationId)
  }, 400)
}

export async function getPendingSyncCount(organizationId?: string): Promise<number> {
  return countPendingOperations(organizationId)
}
