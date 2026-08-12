import { Link } from 'react-router-dom'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../plans/coverage'
import './HomePlanNotice.css'

export function HomePlanNotice() {
  const { subscription, organization, user } = useAuth()
  const coverage = getSubscriptionCoverage(subscription)

  if (!coverage) return null

  const toneClass =
    coverage.tone === 'due'
      ? 'home-plan-notice home-plan-notice--due'
      : coverage.tone === 'soon'
        ? 'home-plan-notice home-plan-notice--soon'
        : 'home-plan-notice'

  const supportText = [
    'Olá, meu acesso BALQO está bloqueado remotamente.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
  ].join('\n')

  return (
    <aside className={toneClass} role={coverage.tone === 'ok' ? 'status' : 'alert'}>
      <div>
        <strong>{coverage.title}</strong>
        <p>{coverage.detail}</p>
      </div>
      {coverage.isRemoteBlocked ? (
        <a
          href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
          target="_blank"
          rel="noreferrer"
        >
          Gestão BALQO
        </a>
      ) : (
        <Link to="/app/billing">Ver planos</Link>
      )}
    </aside>
  )
}
