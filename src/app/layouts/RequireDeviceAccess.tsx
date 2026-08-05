import type { ReactNode } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDeviceSession } from '../../features/devices'
import './RequireOperatorUnlock.css'

export function RequireDeviceAccess({ children }: { children: ReactNode }) {
  const { logout, organization, subscription } = useAuth()
  const { loading, slotBlocked, error, maxDevices, retry } = useDeviceSession()

  if (!organization) return children

  if (loading) {
    return (
      <div className="operator-unlock-boot">
        <p>Verificando aparelho…</p>
      </div>
    )
  }

  // Só o limite de aparelhos do plano impede entrar no app.
  // Bloqueado/removido/limitado entram em modo consulta + sync.
  if (slotBlocked) {
    return (
      <div className="operator-unlock-boot">
        <section className="device-gate">
          <p className="device-gate__eyebrow">Limite de aparelhos</p>
          <h1>Este login não pode entrar aqui</h1>
          <p>
            {error ||
              `O plano atual permite ${maxDevices} aparelho${maxDevices === 1 ? '' : 's'} por vez.`}
          </p>
          <p>
            Saia da loja neste computador ou remova um aparelho antigo em outro que já
            esteja liberado. Plano {subscription?.planId ?? organization.planId}: até{' '}
            {maxDevices} equipamento{maxDevices === 1 ? '' : 's'}.
          </p>
          <div className="device-gate__actions">
            <button type="button" onClick={() => void retry()}>
              Tentar de novo
            </button>
            <button type="button" onClick={() => void logout()}>
              Sair da loja
            </button>
          </div>
        </section>
      </div>
    )
  }

  return children
}
