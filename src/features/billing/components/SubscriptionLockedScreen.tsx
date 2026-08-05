import { Link } from 'react-router-dom'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { SubscriptionCoverage } from '../plans/coverage'
import './SubscriptionLockedScreen.css'

export function SubscriptionLockedScreen({ coverage }: { coverage: SubscriptionCoverage }) {
  const { logout, organization, user } = useAuth()
  const supportText = [
    'Olá, preciso liberar o plano BALQO.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
    `Plano: ${coverage.planName}`,
    'Segue o comprovante para liberação.',
  ].join('\n')

  return (
    <div className="subscription-lock">
      <section className="subscription-lock__card">
        <p className="subscription-lock__eyebrow">Acesso restrito</p>
        <h1>{coverage.title}</h1>
        <p>{coverage.detail}</p>
        <div className="subscription-lock__actions">
          <Link to="/app/billing">Ir para planos</Link>
          <a
            href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp — comprovante
          </a>
          <button type="button" onClick={() => void logout()}>
            Sair da loja
          </button>
        </div>
      </section>
    </div>
  )
}
