import { createId } from '../../shared/lib/ids'
import { nowIso } from '../../shared/lib/dates'
import { localDb, type QueueOperation, type SyncQueueItem } from './db'

export async function enqueueOperation(
  organizationId: string,
  operation: QueueOperation,
  payload: unknown,
  options?: { id?: string },
): Promise<SyncQueueItem> {
  const id = options?.id ?? createId('queue')
  const existing = await localDb.syncQueue.get(id)
  if (existing) return existing

  const item: SyncQueueItem = {
    id,
    organizationId,
    operation,
    payload,
    createdAt: nowIso(),
    attempts: 0,
  }

  await localDb.syncQueue.put(item)

  void import('../sync')
    .then((mod) => mod.requestSyncPass(organizationId))
    .catch(() => undefined)

  return item
}

export async function listPendingOperations(organizationId?: string): Promise<SyncQueueItem[]> {
  if (!organizationId) {
    return localDb.syncQueue.orderBy('createdAt').toArray()
  }

  return localDb.syncQueue.where('organizationId').equals(organizationId).sortBy('createdAt')
}

export async function countPendingOperations(organizationId?: string): Promise<number> {
  if (!organizationId) return localDb.syncQueue.count()
  return localDb.syncQueue.where('organizationId').equals(organizationId).count()
}

export async function removeQueueItem(id: string): Promise<void> {
  await localDb.syncQueue.delete(id)
}

export async function markQueueError(id: string, error: string): Promise<void> {
  const item = await localDb.syncQueue.get(id)
  if (!item) return

  await localDb.syncQueue.update(id, {
    attempts: item.attempts + 1,
    lastError: error,
  })
}

/** Marca erro e esgota tentativas (falha permanente, ex.: pós-bloqueio do aparelho). */
export async function markQueuePermanentError(id: string, error: string, maxAttempts = 8): Promise<void> {
  const item = await localDb.syncQueue.get(id)
  if (!item) return

  await localDb.syncQueue.update(id, {
    attempts: Math.max(item.attempts + 1, maxAttempts),
    lastError: error,
  })
}

/** Limpa o erro e zera tentativas para forçar nova sincronização. */
export async function resetQueueItem(id: string): Promise<void> {
  const item = await localDb.syncQueue.get(id)
  if (!item) return
  await localDb.syncQueue.update(id, {
    attempts: 0,
    lastError: undefined,
  })
}
