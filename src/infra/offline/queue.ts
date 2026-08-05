import { createId } from '../../shared/lib/ids'
import { nowIso } from '../../shared/lib/dates'
import { localDb, type QueueOperation, type SyncQueueItem } from './db'

export async function enqueueOperation(
  organizationId: string,
  operation: QueueOperation,
  payload: unknown,
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: createId('queue'),
    organizationId,
    operation,
    payload,
    createdAt: nowIso(),
    attempts: 0,
  }

  await localDb.syncQueue.add(item)
  return item
}

export async function listPendingOperations(organizationId?: string): Promise<SyncQueueItem[]> {
  if (!organizationId) {
    return localDb.syncQueue.orderBy('createdAt').toArray()
  }

  return localDb.syncQueue.where('organizationId').equals(organizationId).sortBy('createdAt')
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
