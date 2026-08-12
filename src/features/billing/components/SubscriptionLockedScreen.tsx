import { Link } from 'react-router-dom'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { SubscriptionCoverage } from '../plans/coverage'
import './SubscriptionLockedScreen.css'

/** Tela legada — preferir banner + modo consulta. Mantida para mensagens consistentes. */
export function SubscriptionLockedScreen({ coverage }: { coverage: SubscriptionCoverage }) {
  const { logout, organization, user } = useAuth()
  const supportText = [
    coverage.isRemoteBlocked
      ? 'Olá, meu acesso BALQO está bloqueado remotamente.'
      : 'Olá, preciso liberar o plano BALQO.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
    `Plano: ${coverage.planName}`,
    coverage.isRemoteBlocked ? '' : 'Segue o comprovante para liberação.',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="subscription-lock">
      <section className="subscription-lock__card">
        <p className="subscription-lock__eyebrow">Acesso restrito</p>
        <h1>{coverage.title}</h1>
        <p>{coverage.detail}</p>
        <p className="subscription-lock__hint">
          Você pode consultar produtos, clientes e relatórios. Vendas e alterações
          estão bloqueadas.
        </p>
        <div className="subscription-lock__actions">
          {coverage.isRemoteBlocked ? (
            <a
              href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp — gestão BALQO
            </a>
          ) : (
            <Link to="/app/billing">Ir para planos</Link>
          )}
          <Link to="/app/reports" className="subscription-lock__actions--secondary">
            Relatórios / exportar
          </Link>
          <Link to="/app/sync" className="subscription-lock__actions--secondary">
            Sincronizar
          </Link>
          <Link to="/app" className="subscription-lock__actions--secondary">
            Consultar início
          </Link>
          {!coverage.isRemoteBlocked ? (
            <a
              href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp — comprovante
            </a>
          ) : null}
          <button type="button" onClick={() => void logout()}>
            Sair da loja
          </button>
        </div>
      </section>
    </div>
  )
}
