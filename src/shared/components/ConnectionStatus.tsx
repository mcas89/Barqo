import { useEffect, useState } from 'react'
import { subscribeSyncStatus } from '../../infra/sync'
import { SYNC_STATUS, type SyncStatus } from '../constants'
import './ConnectionStatus.css'

const LABELS: Record<SyncStatus, string> = {
  [SYNC_STATUS.ONLINE]: 'Online',
  [SYNC_STATUS.OFFLINE]: 'Offline',
  [SYNC_STATUS.SYNCING]: 'Sincronizando',
  [SYNC_STATUS.ERROR]: 'Falha na sync',
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<SyncStatus>(SYNC_STATUS.ONLINE)

  useEffect(() => subscribeSyncStatus(setStatus), [])

  return (
    <span className={`connection-status connection-status--${status}`} title={LABELS[status]}>
      <span className="connection-status__dot" aria-hidden />
      {LABELS[status]}
    </span>
  )
}
