import { Link } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../plans/coverage'
import './HomePlanNotice.css'

export function HomePlanNotice() {
  const { subscription } = useAuth()
  const coverage = getSubscriptionCoverage(subscription)

  if (!coverage) return null

  const toneClass =
    coverage.tone === 'due'
      ? 'home-plan-notice home-plan-notice--due'
      : coverage.tone === 'soon'
        ? 'home-plan-notice home-plan-notice--soon'
        : 'home-plan-notice'

  return (
    <aside className={toneClass} role={coverage.tone === 'ok' ? 'status' : 'alert'}>
      <div>
        <strong>{coverage.title}</strong>
        <p>{coverage.detail}</p>
      </div>
      <Link to="/app/billing">Ver planos</Link>
    </aside>
  )
}
