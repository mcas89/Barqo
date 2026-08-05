import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { PosUnlockScreen } from '../../features/pos/components/PosUnlockScreen'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { useAuth } from '../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../../features/billing/plans/coverage'
import './RequireOperatorUnlock.css'

export function RequireOperatorUnlock({ children }: { children: ReactNode }) {
  const { operator, pinRequired, loading } = usePosOperator()
  const { subscription } = useAuth()
  const location = useLocation()
  const coverage = getSubscriptionCoverage(subscription)
  const payingWhileLocked =
    location.pathname.startsWith('/app/billing') && coverage?.canOperate === false

  if (loading) {
    return (
      <div className="operator-unlock-boot">
        <p>Carregando…</p>
      </div>
    )
  }

  if (pinRequired && !operator && !payingWhileLocked) {
    return (
      <div className="operator-unlock-boot">
        <PosUnlockScreen />
      </div>
    )
  }

  return children
}
