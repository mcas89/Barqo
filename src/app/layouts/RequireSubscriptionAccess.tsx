import type { ReactNode } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import './RequireOperatorUnlock.css'

/**
 * Assinatura bloqueada/vencida: modo consulta (ver tudo).
 * Escritas e vendas são barradas por getOperationAccess / operationLimited.
 */
export function RequireSubscriptionAccess({ children }: { children: ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="operator-unlock-boot">
        <p>Verificando plano…</p>
      </div>
    )
  }

  return children
}
