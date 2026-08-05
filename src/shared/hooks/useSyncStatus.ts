import { useEffect, useState } from 'react'
import { getSyncStatus, subscribeSyncStatus } from '../../infra/sync'
import type { SyncStatus } from '../constants'

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)

  useEffect(() => subscribeSyncStatus(setStatus), [])

  return status
}
