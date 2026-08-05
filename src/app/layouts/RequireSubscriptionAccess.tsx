import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../../features/billing/plans/coverage'
import { SubscriptionLockedScreen } from '../../features/billing/components/SubscriptionLockedScreen'
import { isLimitedAccessPath } from '../../features/devices/services/operation-access'
import { useDeviceSession } from '../../features/devices'
import './RequireOperatorUnlock.css'

export function RequireSubscriptionAccess({ children }: { children: ReactNode }) {
  const { subscription, loading } = useAuth()
  const location = useLocation()
  const { operationLimited, accessState } = useDeviceSession()
  const coverage = getSubscriptionCoverage(subscription)
  const billingPath = location.pathname.startsWith('/app/billing')
  const limitedOk = isLimitedAccessPath(location.pathname)

  if (loading) {
    return (
      <div className="operator-unlock-boot">
        <p>Verificando plano…</p>
      </div>
    )
  }

  // Assinatura online bloqueada: permite consulta/export/sync/billing.
  if (coverage && !coverage.canOperate) {
    if (billingPath || limitedOk) return children
    return <SubscriptionLockedScreen coverage={coverage} />
  }

  // Dispositivo/lease limitado: bloqueia rotas operacionais de escrita.
  if (
    operationLimited &&
    (accessState === 'blocked' ||
      accessState === 'removed' ||
      accessState === 'limited' ||
      accessState === 'clock_invalid')
  ) {
    if (limitedOk || billingPath) return children
    // PDV e escritas: ainda renderiza com banner; o gate de ação impede a venda.
    // Mantém navegação; AccessNoticeBanner orienta.
  }

  return children
}
