import { useEffect } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { requestSyncPass } from '../../infra/sync'

/** Dispara sync da fila local no boot quando a loja está pronta. */
export function SyncBootstrap() {
  const { organization } = useAuth()
  const organizationId = organization?.id

  useEffect(() => {
    if (!organizationId) return
    requestSyncPass(organizationId)
  }, [organizationId])

  return null
}
