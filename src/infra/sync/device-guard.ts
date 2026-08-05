import { doc, getDoc } from 'firebase/firestore'
import { getFirestoreDb } from '../firebase'
import { DEVICE_STATUS } from '../../features/devices/types'
import type {
  CashCloseQueuePayload,
  CashOpenQueuePayload,
  SaleCreateQueuePayload,
} from '../offline'
import type { SyncQueueItem } from '../offline/db'

export class DeviceSyncRejectedError extends Error {
  readonly permanent = true

  constructor(message: string) {
    super(message)
    this.name = 'DeviceSyncRejectedError'
  }
}

/**
 * Recusa operações criadas depois do bloqueio/remoção do aparelho.
 * Ops anteriores ao corte continuam sincronizando.
 */
export async function assertQueueItemAllowedAgainstDevice(
  item: SyncQueueItem,
): Promise<void> {
  const meta = extractDeviceMeta(item)
  if (!meta?.deviceId || !meta.createdAt) return

  const db = getFirestoreDb()
  if (!db) return

  const snap = await getDoc(
    doc(db, 'organizations', item.organizationId, 'devices', meta.deviceId),
  )
  if (!snap.exists()) {
    // Dispositivo sumiu do Firestore: ainda permite sync de ops já feitas (fila local).
    return
  }

  const data = snap.data()
  const status = data.status as string | undefined
  if (status !== DEVICE_STATUS.BLOCKED && status !== DEVICE_STATUS.REMOVED) return

  const cutoffRaw =
    (data.statusChangedAt as string | undefined) ||
    (data.blockedAt as string | undefined) ||
    null
  if (!cutoffRaw) {
    throw new DeviceSyncRejectedError(
      'Dispositivo bloqueado ou removido. Operações novas não serão sincronizadas.',
    )
  }

  if (meta.createdAt > cutoffRaw) {
    throw new DeviceSyncRejectedError(
      'Operação criada após o bloqueio/remoção deste aparelho. Não será sincronizada.',
    )
  }
}

function extractDeviceMeta(
  item: SyncQueueItem,
): { deviceId?: string; createdAt?: string } | null {
  if (item.operation === 'sale.create') {
    const sale = (item.payload as SaleCreateQueuePayload)?.sale
    return {
      deviceId: sale?.deviceId,
      createdAt: sale?.createdAt ?? item.createdAt,
    }
  }
  if (item.operation === 'cash.open') {
    const session = (item.payload as CashOpenQueuePayload)?.session
    return {
      deviceId: session?.openedDeviceId,
      createdAt: session?.openedAt ?? item.createdAt,
    }
  }
  if (item.operation === 'cash.close') {
    const session = (item.payload as CashCloseQueuePayload)?.session
    return {
      deviceId: session?.closedDeviceId ?? session?.openedDeviceId,
      createdAt: session?.closedAt ?? item.createdAt,
    }
  }
  return { createdAt: item.createdAt }
}
