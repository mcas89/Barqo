import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../../features/billing/plans/coverage'
import { SubscriptionLockedScreen } from '../../features/billing/components/SubscriptionLockedScreen'
import './RequireOperatorUnlock.css'

export function RequireSubscriptionAccess({ children }: { children: ReactNode }) {
  const { subscription, loading } = useAuth()
  const location = useLocation()
  const coverage = getSubscriptionCoverage(subscription)
  const billingPath = location.pathname.startsWith('/app/billing')

  if (loading) {
    return (
      <div className="operator-unlock-boot">
        <p>Verificando plano…</p>
      </div>
    )
  }

  if (!coverage) return children
  if (coverage.canOperate || billingPath) return children

  return <SubscriptionLockedScreen coverage={coverage} />
}
