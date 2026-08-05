import { SYNC_STATUS, type SyncStatus } from '../../shared/constants'
import { requestSyncPass } from './sync-engine'

type Listener = (status: SyncStatus) => void

let currentStatus: SyncStatus = navigator.onLine ? SYNC_STATUS.ONLINE : SYNC_STATUS.OFFLINE
const listeners = new Set<Listener>()

function emit(status: SyncStatus) {
  currentStatus = status
  listeners.forEach((listener) => listener(status))
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener)
  listener(currentStatus)
  return () => listeners.delete(listener)
}

export function setSyncStatus(status: SyncStatus) {
  emit(status)
}

function handleOnline() {
  emit(SYNC_STATUS.ONLINE)
  requestSyncPass()
}

function handleOffline() {
  emit(SYNC_STATUS.OFFLINE)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}
