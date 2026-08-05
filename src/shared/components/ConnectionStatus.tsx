import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPendingSyncCount, subscribeSyncStatus } from '../../infra/sync'
import { SYNC_STATUS, type SyncStatus } from '../constants'
import { useAuth } from '../hooks/useAuth'
import './ConnectionStatus.css'

const LABELS: Record<SyncStatus, string> = {
  [SYNC_STATUS.ONLINE]: 'Online',
  [SYNC_STATUS.OFFLINE]: 'Offline',
  [SYNC_STATUS.SYNCING]: 'Sincronizando',
  [SYNC_STATUS.ERROR]: 'Falha na sync',
}

export function ConnectionStatus() {
  const { organization } = useAuth()
  const [status, setStatus] = useState<SyncStatus>(SYNC_STATUS.ONLINE)
  const [pending, setPending] = useState(0)

  useEffect(() => subscribeSyncStatus(setStatus), [])

  useEffect(() => {
    let cancelled = false

    async function refreshCount() {
      try {
        const count = await getPendingSyncCount(organization?.id)
        if (!cancelled) setPending(count)
      } catch {
        if (!cancelled) setPending(0)
      }
    }

    void refreshCount()
    const timer = window.setInterval(() => void refreshCount(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [organization?.id, status])

  const label =
    pending > 0 ? `${LABELS[status]} · ${pending}` : LABELS[status]
  const title =
    pending > 0
      ? `${LABELS[status]} — ${pending} operação(ões) pendente(s)`
      : LABELS[status]

  return (
    <Link
      to="/app/sync"
      className={`connection-status connection-status--${status}`}
      title={title}
    >
      <span className="connection-status__dot" aria-hidden />
      {label}
    </Link>
  )
}
