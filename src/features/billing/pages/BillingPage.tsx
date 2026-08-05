import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLES,
  PLAN_LIST,
  TARGET_PLAN_ID,
  equivalentMonthlyCents,
  formatCycleDuration,
  formatPlanPrice,
  getPlan,
  getPlanPriceCents,
  getSubscriptionCoverage,
  quotePlanCheckout,
  type BillingCycle,
  type PlanId,
} from '../plans'
import { formatMoney } from '../../../shared/lib/money'
import { useAuth } from '../../../shared/hooks/useAuth'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { PERMISSIONS } from '../../users/permissions'
import { startPlanCheckout } from '../services/subscription-service'
import { writePendingCheckout } from '../pending-checkout'
import { usePendingCheckout } from '../hooks/usePendingCheckoutWatcher'
import { SubscriptionDetailsCard } from '../components/SubscriptionDetailsCard'
import { FiscalNotice } from '../../legal'
import './BillingPage.css'

const CYCLES: BillingCycle[] = [
  BILLING_CYCLES.MONTHLY,
  BILLING_CYCLES.SEMIANNUAL,
  BILLING_CYCLES.ANNUAL,
]

export function BillingPage() {
  const { organization, subscription, user, refreshSession } = useAuth()
  const { hasPrivilegedAccess, can } = usePosOperator()
  const [cycle, setCycle] = useState<BillingCycle>(
    subscription?.billingCycle ?? BILLING_CYCLES.MONTHLY,
  )
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = usePendingCheckout()

  const coverage = getSubscriptionCoverage(subscription)
  const canPay =
    hasPrivilegedAccess ||
    can(PERMISSIONS.MANAGE_BILLING) ||
    coverage?.canOperate === false

  useEffect(() => {
    if (subscription?.billingCycle) setCycle(subscription.billingCycle)
  }, [subscription?.billingCycle])

  async function pay(planId: PlanId) {
    if (!organization || !canPay) return
    setError(null)
    setBusyPlan(planId)
    const checkoutTab = window.open('about:blank', 'balqo-infinitepay')
    try {
      const phone = organization.whatsapp
        ? organization.whatsapp.startsWith('55')
          ? `+${organization.whatsapp}`
          : `+55${organization.whatsapp}`
        : undefined
      const started = await startPlanCheckout({
        organizationId: organization.id,
        planId,
        billingCycle: cycle,
        subscription,
        customer: {
          name: user?.displayName,
          email: user?.email,
          phone_number: phone,
        },
      })
      await refreshSession()
      if (started.immediate || !started.checkoutUrl) {
        checkoutTab?.close()
        setBusyPlan(null)
        return
      }
      writePendingCheckout({
        organizationId: organization.id,
        orderNsu: started.orderNsu,
        planId,
        billingCycle: cycle,
        checkoutUrl: started.checkoutUrl,
        gatewayId: started.gatewayId,
        slug: started.slug,
        startedAt: new Date().toISOString(),
      })
      if (checkoutTab && !checkoutTab.closed) {
        checkoutTab.location.href = started.checkoutUrl
      } else {
        window.location.assign(started.checkoutUrl)
      }
      setBusyPlan(null)
    } catch (err) {
      checkoutTab?.close()
      setError(err instanceof Error ? err.message : 'Falha ao abrir o pagamento.')
      setBusyPlan(null)
    }
  }

  return (
    <section className="billing-page">
      <header className="billing-page__header">
        <h1>Planos BALQO</h1>
        <p>
          O Entrada inclui 10 dias grátis. Depois de assinar, você só sobe de plano — sem
          voltar atrás — e paga a diferença do valor já quitado. Semestral e anual saem com
          desconto.
        </p>
        <FiscalNotice />
      </header>

      <SubscriptionDetailsCard />

      <h2 className="billing-page__catalog-title">Renovar ou subir de plano</h2>

      <div className="billing-page__cycles" role="tablist" aria-label="Período de cobrança">
        {CYCLES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={cycle === item}
            className={
              cycle === item
                ? 'billing-page__cycle billing-page__cycle--active'
                : 'billing-page__cycle'
            }
            onClick={() => setCycle(item)}
          >
            {BILLING_CYCLE_LABELS[item]}
            {item === BILLING_CYCLES.SEMIANNUAL ? <small>1 mês grátis</small> : null}
            {item === BILLING_CYCLES.ANNUAL ? <small>2 meses grátis</small> : null}
          </button>
        ))}
      </div>

      {error && (
        <p className="billing-page__error" role="alert">
          {error}
        </p>
      )}

      {pending && pending.organizationId === organization?.id && (
        <p className="billing-page__waiting">
          Pagamento de <strong>{getPlan(pending.planId).name}</strong> aberto em outra aba.
          Pode continuar usando o BALQO — ativamos o plano automaticamente ao confirmar.
        </p>
      )}

      {!canPay && (
        <p className="billing-page__hint">Somente proprietário ou gerente pode assinar.</p>
      )}

      <div className="billing-page__grid">
        {PLAN_LIST.map((plan) => {
          const isTarget = plan.id === TARGET_PLAN_ID
          const priceCents = getPlanPriceCents(plan.id, cycle)
          const quote = quotePlanCheckout({
            subscription,
            targetPlanId: plan.id,
            cycle,
          })
          const locked = !quote.allowed
          return (
            <article
              key={plan.id}
              className={[
                'billing-card',
                plan.highlighted || isTarget ? 'billing-card--highlight' : '',
                locked ? 'billing-card--locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {(plan.highlighted || isTarget) && (
                <span className="billing-card__badge">Mais escolhido</span>
              )}
              <h2>{plan.name}</h2>
              <p className="billing-card__tagline">{plan.tagline}</p>
              <p className="billing-card__price">
                {formatMoney(quote.chargeCents < priceCents ? quote.chargeCents : priceCents)}
                <span>/{formatCycleDuration(cycle)}</span>
              </p>
              {quote.chargeCents < priceCents && quote.allowed ? (
                <p className="billing-card__equiv">
                  De {formatMoney(priceCents)} · diferença {formatMoney(quote.chargeCents)}
                </p>
              ) : cycle !== BILLING_CYCLES.MONTHLY ? (
                <p className="billing-card__equiv">
                  Equivale a {formatMoney(equivalentMonthlyCents(plan.id, cycle))}/mês
                </p>
              ) : null}
              <p className="billing-card__audience">{plan.audience}</p>

              <ul className="billing-card__list">
                {plan.includedHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p className="billing-card__pain">{quote.hint || plan.growthPain}</p>
              <p className="billing-card__ref">{formatPlanPrice(plan.id)}</p>

              <button
                type="button"
                className="billing-card__pay"
                disabled={!canPay || busyPlan !== null || locked}
                onClick={() => void pay(plan.id)}
              >
                {busyPlan === plan.id ? 'Abrindo pagamento…' : quote.buttonLabel}
              </button>
            </article>
          )
        })}
      </div>

      <footer className="billing-page__note">
        O checkout abre em outra aba. Depois de pagar, pode clicar em Continuar ou só voltar ao
        BALQO — o sistema fica escutando e ativa o plano sozinho. Nenhum plano emite NF-e: o cupom
        é comprovante interno.{' '}
        <Link to="/termos">Termos de uso</Link> · <Link to="/privacidade">Privacidade</Link>
      </footer>
    </section>
  )
}
