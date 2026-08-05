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
        <p className="subscription-lock__hint">
          Vendas e alterações operacionais estão bloqueadas. Você ainda pode consultar
          produtos e clientes, exportar relatórios, sincronizar pendências e regularizar
          o plano.
        </p>
        <div className="subscription-lock__actions">
          <Link to="/app/billing">Ir para planos</Link>
          <Link to="/app/reports" className="subscription-lock__actions--secondary">
            Relatórios / exportar
          </Link>
          <Link to="/app/sync" className="subscription-lock__actions--secondary">
            Sincronizar
          </Link>
          <Link to="/app" className="subscription-lock__actions--secondary">
            Consultar início
          </Link>
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
