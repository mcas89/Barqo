import { Link } from 'react-router-dom'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../../billing/plans/coverage'
import { useDeviceSession } from '../hooks/useDeviceSession'
import './AccessNoticeBanner.css'

export function AccessNoticeBanner() {
  const { subscription, organization, user } = useAuth()
  const coverage = getSubscriptionCoverage(subscription)
  const { accessState, warning, error, operationLimited } = useDeviceSession()
  const subscriptionBlocked = Boolean(coverage && !coverage.canOperate)
  const remoteBlocked = Boolean(coverage?.isRemoteBlocked)

  if (accessState === 'blocked') {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>Dispositivo bloqueado</strong>
        <p>
          {error ||
            'Este dispositivo foi bloqueado. Você pode consultar dados e sincronizar, mas não pode vender nem alterar nada.'}
        </p>
        <Link to="/app/sync">Ver sincronização</Link>
      </aside>
    )
  }

  if (accessState === 'removed') {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>Dispositivo não autorizado</strong>
        <p>
          {error ||
            'Este dispositivo não está mais autorizado. As operações pendentes serão preservadas. Fale com o responsável pelo comércio.'}
        </p>
        <Link to="/app/sync">Ver sincronização</Link>
      </aside>
    )
  }

  if (accessState === 'limited' || accessState === 'clock_invalid') {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>Acesso limitado</strong>
        <p>
          {error ||
            (accessState === 'clock_invalid'
              ? 'A data ou hora deste dispositivo parece incorreta. Conecte-se à internet para validar o acesso.'
              : 'Validação do aparelho expirada. Conecte-se à internet para voltar a vender. Consulta e sincronização continuam liberadas.')}
        </p>
        <Link to="/app/sync">Sincronizar pendências</Link>
      </aside>
    )
  }

  if (subscriptionBlocked) {
    const supportText = [
      'Olá, meu acesso BALQO está bloqueado remotamente.',
      `Loja: ${organization?.name ?? '—'}`,
      `Nome: ${user?.displayName ?? '—'}`,
      `Plano: ${coverage?.planName ?? '—'}`,
    ].join('\n')

    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>{coverage?.title ?? 'Acesso bloqueado'}</strong>
        <p>
          {coverage?.detail ??
            'Você pode consultar os dados, mas não vender nem alterar nada.'}
        </p>
        {remoteBlocked ? (
          <a
            href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp — gestão BALQO
          </a>
        ) : (
          <>
            <Link to="/app/billing">Ver planos</Link>
            {' · '}
            <Link to="/app/reports">Relatórios</Link>
            {' · '}
            <Link to="/app/sync">Sync</Link>
          </>
        )}
      </aside>
    )
  }

  if (operationLimited) {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>Operação restrita</strong>
        <p>
          Não é possível iniciar novas vendas nem alterações neste momento.
          Consulta, exportação e sincronização continuam disponíveis.
        </p>
        <Link to="/app/billing">Ver planos</Link>
        {' · '}
        <Link to="/app/reports">Relatórios</Link>
        {' · '}
        <Link to="/app/sync">Sync</Link>
      </aside>
    )
  }

  if (warning) {
    return (
      <aside className="access-notice access-notice--warn" role="status">
        <strong>Atenção</strong>
        <p>{warning}</p>
      </aside>
    )
  }

  return null
}
