import { useEffect, useState } from 'react'
import { BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { formatMoney } from '../../../shared/lib/money'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  BILLING_CYCLE_LABELS,
  getPlan,
  getSubscriptionCoverage,
} from '../plans'
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

function gatewayLabel(id?: string) {
  if (id === 'infinitepay') return 'InfinitePay'
  return id || '—'
}

function orderStatusLabel(status: BillingOrder['status']) {
  return status === 'paid' ? 'Pago' : 'Aguardando'
}

export function SubscriptionDetailsCard() {
  const { organization, subscription, user } = useAuth()
  const [orders, setOrders] = useState<BillingOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  const coverage = getSubscriptionCoverage(subscription)
  const lastPayment = subscription?.lastPayment
  const plan = subscription ? getPlan(subscription.planId) : null

  useEffect(() => {
    if (!organization?.id) {
      setOrders([])
      setLoadingOrders(false)
      return
    }
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
  }, [organization?.id, subscription?.updatedAt, lastPayment?.paidAt])

  if (!subscription || !plan || !coverage) return null

  const statusLabel = coverage.isTrial
    ? 'Período de teste'
    : coverage.isPendingPayment
      ? 'Pagamento pendente'
      : coverage.isBlocked
        ? 'Bloqueado'
        : coverage.tone === 'due'
          ? 'Vencido'
          : coverage.tone === 'soon'
            ? 'Vence em breve'
            : coverage.isPaidUp
              ? 'Em dia'
              : '—'

  const receiptUrl =
    lastPayment?.receiptUrl ||
    orders.find((order) => order.status === 'paid' && order.receiptUrl)?.receiptUrl

  const supportText = [
    'Olá, preciso do comprovante / dados do meu plano BALQO.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
    `Plano: ${plan.name}`,
    lastPayment?.orderNsu ? `Pedido: ${lastPayment.orderNsu}` : null,
    lastPayment?.transactionNsu ? `Transação: ${lastPayment.transactionNsu}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <section id="assinatura" className={`sub-card sub-card--${coverage.tone}`}>
      <header className="sub-card__head">
        <div>
          <p className="sub-card__eyebrow">Minha assinatura</p>
          <h2>{plan.name}</h2>
          <p>{plan.tagline}</p>
        </div>
        <strong className="sub-card__status">{statusLabel}</strong>
      </header>

      <dl className="sub-card__grid">
        <div>
          <dt>Ciclo</dt>
          <dd>
            {subscription.billingCycle
              ? BILLING_CYCLE_LABELS[subscription.billingCycle]
              : coverage.isTrial
                ? 'Teste grátis'
                : '—'}
          </dd>
        </div>
        <div>
          <dt>{coverage.isTrial ? 'Teste até' : 'Pago até'}</dt>
          <dd>{formatDate(coverage.accessUntil)}</dd>
        </div>
        <div>
          <dt>Usuários / aparelhos</dt>
          <dd>
            {plan.limits.maxUsers} usuário{plan.limits.maxUsers === 1 ? '' : 's'} ·{' '}
            {plan.limits.maxDevices} aparelho{plan.limits.maxDevices === 1 ? '' : 's'}
          </dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>{coverage.detail}</dd>
        </div>
      </dl>

      <div className="sub-card__payment">
        <h3>Último pagamento</h3>
        {lastPayment ? (
          <>
            <dl className="sub-card__grid">
              <div>
                <dt>Valor</dt>
                <dd>{formatMoney(lastPayment.amountCents)}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{formatDateTime(lastPayment.paidAt)}</dd>
              </div>
              <div>
                <dt>Meio</dt>
                <dd>{gatewayLabel(lastPayment.gatewayId)}</dd>
              </div>
              <div>
                <dt>Pedido</dt>
                <dd>{lastPayment.orderNsu}</dd>
              </div>
              {lastPayment.transactionNsu ? (
                <div>
                  <dt>Transação</dt>
                  <dd>{lastPayment.transactionNsu}</dd>
                </div>
              ) : null}
              {lastPayment.captureMethod ? (
                <div>
                  <dt>Forma</dt>
                  <dd>{lastPayment.captureMethod}</dd>
                </div>
              ) : null}
            </dl>
            <div className="sub-card__actions">
              {receiptUrl ? (
                <a href={receiptUrl} target="_blank" rel="noreferrer">
                  Ver comprovante
                </a>
              ) : (
                <a
                  className="sub-card__whatsapp"
                  href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp — pedir comprovante
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="sub-card__empty">
            {coverage.isTrial
              ? 'Ainda não há pagamento. O trial está ativo até a data acima.'
              : 'Nenhum pagamento confirmado ainda.'}
          </p>
        )}
      </div>

      <div className="sub-card__history">
        <h3>Histórico</h3>
        {loadingOrders ? (
          <p className="sub-card__empty">Carregando pagamentos…</p>
        ) : orders.length === 0 ? (
          <p className="sub-card__empty">Nenhum pedido registrado nesta loja.</p>
        ) : (
          <ul>
            {orders.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>
                    {getPlan(order.planId).name} · {BILLING_CYCLE_LABELS[order.billingCycle]}
                  </strong>
                  <span>
                    {formatMoney(order.amountCents)} · {orderStatusLabel(order.status)} ·{' '}
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
    </section>
  )
}
