import { isFirebaseConfigured } from '../firebase'
import { listPendingOperations } from '../offline'
import { setSyncStatus } from './status'
import { SYNC_STATUS } from '../../shared/constants'

/**
 * Motor de sincronização — stub da V0.1.
 * Quando o Firebase estiver configurado, processará a fila local.
 */
export async function runSyncPass(organizationId?: string): Promise<{ pending: number }> {
  const pending = await listPendingOperations(organizationId)

  if (!navigator.onLine) {
    setSyncStatus(SYNC_STATUS.OFFLINE)
    return { pending: pending.length }
  }

  if (!isFirebaseConfigured()) {
    setSyncStatus(SYNC_STATUS.ONLINE)
    return { pending: pending.length }
  }

  if (pending.length === 0) {
    setSyncStatus(SYNC_STATUS.ONLINE)
    return { pending: 0 }
  }

  setSyncStatus(SYNC_STATUS.SYNCING)
  // TODO: enviar itens da fila para Firestore e limpar com sucesso
  setSyncStatus(SYNC_STATUS.ONLINE)
  return { pending: pending.length }
}
