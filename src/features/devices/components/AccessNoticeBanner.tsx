import { Link } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getSubscriptionCoverage } from '../../billing/plans/coverage'
import { useDeviceSession } from '../hooks/useDeviceSession'
import './AccessNoticeBanner.css'

export function AccessNoticeBanner() {
  const { subscription } = useAuth()
  const coverage = getSubscriptionCoverage(subscription)
  const { accessState, warning, error, operationLimited } = useDeviceSession()
  const subscriptionBlocked = Boolean(coverage && !coverage.canOperate)

  if (accessState === 'blocked') {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>Dispositivo bloqueado</strong>
        <p>
          {error ||
            'Este dispositivo foi bloqueado pelo administrador. Você pode consultar dados e sincronizar operações pendentes, mas não pode realizar novas vendas.'}
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

  if (subscriptionBlocked || operationLimited) {
    return (
      <aside className="access-notice access-notice--block" role="alert">
        <strong>{subscriptionBlocked ? 'Assinatura bloqueada' : 'Operação restrita'}</strong>
        <p>
          {subscriptionBlocked
            ? 'Vendas estão pausadas até regularizar o plano. Consulta, exportação e sincronização continuam disponíveis.'
            : 'Não é possível iniciar novas vendas neste momento. Consulta, exportação e sincronização continuam disponíveis.'}
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
