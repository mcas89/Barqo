import { Link } from 'react-router-dom'
import { getPlan } from '../plans'
import { clearPendingCheckout } from '../pending-checkout'
import { usePendingCheckout } from '../hooks/usePendingCheckoutWatcher'
import './PendingCheckoutBanner.css'

export function PendingCheckoutBanner() {
  const pending = usePendingCheckout()
  if (!pending) return null

  const plan = getPlan(pending.planId)

  return (
    <aside className="pending-checkout-banner" role="status">
      <div>
        <strong>Aguardando pagamento · {plan.name}</strong>
        <p>Pague na aba da InfinitePay. O plano ativa sozinho aqui, sem voltar para esta tela.</p>
      </div>
      <div className="pending-checkout-banner__actions">
        <a href={pending.checkoutUrl} target="_blank" rel="noreferrer">
          Abrir pagamento
        </a>
        <Link to="/app/billing">Planos</Link>
        <button type="button" onClick={() => clearPendingCheckout()}>
          Dispensar
        </button>
      </div>
    </aside>
  )
}
