import { useEffect, useState } from 'react'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { formatMoney } from '../../../shared/lib/money'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import { BILLING_CYCLE_LABELS, getPlan, getSubscriptionCoverage } from '../plans'
import { listBillingOrders, type BillingOrder } from '../services/subscription-service'
import './SubscriptionDetailsCard.css'

function formatDateTime(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

export function SubscriptionDetailsCard() {
  const { organization, subscription, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const coverage = getSubscriptionCoverage(subscription)
  const lastPayment = subscription?.lastPayment
  const plan = subscription ? getPlan(subscription.planId) : null

  useEffect(() => {
    if (!open || !organization?.id) return
    let cancelled = false
    setLoadingOrders(true)
    void listBillingOrders(organization.id)
      .then((items) => {
        if (!cancelled) setOrders(items)
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, organization?.id, subscription?.updatedAt])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!subscription || !plan || !coverage) return null

  const statusLabel = coverage.isTrial
    ? 'Teste'
    : coverage.isPendingPayment
      ? 'Pendente'
      : coverage.isBlocked
        ? 'Bloqueado'
        : coverage.tone === 'due'
          ? 'Vencido'
          : coverage.tone === 'soon'
            ? 'Vence em breve'
            : coverage.isPaidUp
              ? 'Em dia'
              : '—'

  const cycleLabel = subscription.billingCycle
    ? BILLING_CYCLE_LABELS[subscription.billingCycle]
    : coverage.isTrial
      ? 'Teste grátis'
      : null

  const receiptUrl =
    lastPayment?.receiptUrl ||
    orders.find((order) => order.status === 'paid' && order.receiptUrl)?.receiptUrl

  const supportText = [
    'Olá, preciso do comprovante / dados do meu plano BALQO.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
    `Plano: ${plan.name}`,
    lastPayment?.orderNsu ? `Pedido: ${lastPayment.orderNsu}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <>
      <button
        type="button"
        id="assinatura"
        className={`sub-mini sub-mini--${coverage.tone}`}
        onClick={() => setOpen(true)}
      >
        <span>
          <strong>{plan.name}</strong>
          <em>
            {cycleLabel ? `${cycleLabel} · ` : ''}
            {coverage.isTrial ? 'teste até' : 'pago até'} {formatDate(coverage.accessUntil)}
          </em>
        </span>
        <b>{statusLabel}</b>
      </button>

      {open ? (
        <div className="sub-modal" role="dialog" aria-modal="true" aria-labelledby="sub-modal-title">
          <button type="button" className="sub-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="sub-modal__panel">
            <header>
              <div>
                <p>Histórico da assinatura</p>
                <h2 id="sub-modal-title">{plan.name}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </header>

            <p className="sub-modal__summary">
              {statusLabel}
              {cycleLabel ? ` · ${cycleLabel}` : ''} ·{' '}
              {coverage.isTrial ? 'teste até' : 'pago até'} {formatDate(coverage.accessUntil)}
            </p>

            {lastPayment ? (
              <p className="sub-modal__summary">
                Último pagamento: {formatMoney(lastPayment.amountCents)} em{' '}
                {formatDateTime(lastPayment.paidAt)}
              </p>
            ) : (
              <p className="sub-modal__summary">Nenhum pagamento confirmado ainda.</p>
            )}

            <div className="sub-modal__actions">
              {receiptUrl ? (
                <a href={receiptUrl} target="_blank" rel="noreferrer">
                  Ver comprovante
                </a>
              ) : (
                <a
                  className="sub-modal__whatsapp"
                  href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp — comprovante
                </a>
              )}
            </div>

            <h3>Pagamentos</h3>
            {loadingOrders ? (
              <p className="sub-modal__empty">Carregando…</p>
            ) : orders.length === 0 ? (
              <p className="sub-modal__empty">Nenhum pedido nesta loja.</p>
            ) : (
              <ul>
                {orders.map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>
                        {getPlan(order.planId).name} · {BILLING_CYCLE_LABELS[order.billingCycle]}
                      </strong>
                      <span>
                        {formatMoney(order.amountCents)} ·{' '}
                        {order.status === 'paid' ? 'Pago' : 'Aguardando'} ·{' '}
                        {formatDateTime(order.paidAt ?? order.createdAt)}
                      </span>
                    </div>
                    {order.receiptUrl ? (
                      <a href={order.receiptUrl} target="_blank" rel="noreferrer">
                        Comprovante
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
