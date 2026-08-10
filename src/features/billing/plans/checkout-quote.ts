import { formatMoney } from '../../../shared/lib/money'
import { getSubscriptionCoverage } from './coverage'
import { getPlan, getPlanPriceCents } from './gates'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_MONTHS,
  type BillingCycle,
  type OrganizationSubscription,
  type PlanId,
} from './types'

export type PlanCheckoutAction =
  | 'subscribe'
  | 'renew'
  | 'upgrade'
  | 'current'
  | 'downgrade'
  | 'cycle_down'

export interface PlanCheckoutQuote {
  action: PlanCheckoutAction
  allowed: boolean
  chargeCents: number
  fullPriceCents: number
  creditCents: number
  keepPaidThrough: boolean
  buttonLabel: string
  hint?: string
}

export function getPlanRank(planId: PlanId): number {
  if (planId === 'salao') return 3
  if (planId === 'controle') return 2
  if (planId === 'essencial') return 1
  return 0
}

export function remainingPaymentCreditCents(
  subscription: OrganizationSubscription | null | undefined,
): number {
  const last = subscription?.lastPayment
  const through = subscription?.paidThrough
  if (!last?.amountCents || !last.paidAt || !through) return 0
  const end = new Date(through).getTime()
  const start = new Date(last.paidAt).getTime()
  const now = Date.now()
  if (end <= now) return 0
  if (end <= start) return last.amountCents
  return Math.round(last.amountCents * ((end - now) / (end - start)))
}

export function quotePlanCheckout(input: {
  subscription: OrganizationSubscription | null | undefined
  targetPlanId: PlanId
  cycle: BillingCycle
}): PlanCheckoutQuote {
  const target = getPlan(input.targetPlanId)
  const fullPriceCents = getPlanPriceCents(input.targetPlanId, input.cycle)
  const subscription = input.subscription
  const paidUp = getSubscriptionCoverage(subscription)?.isPaidUp === true
  const floorPlanId = subscription?.lastPayment ? subscription.planId : null

  if (!floorPlanId) {
    return {
      action: subscription?.lastPayment ? 'renew' : 'subscribe',
      allowed: true,
      chargeCents: fullPriceCents,
      fullPriceCents,
      creditCents: 0,
      keepPaidThrough: false,
      buttonLabel: `Assinar ${target.name}`,
    }
  }

  const rankDiff = getPlanRank(input.targetPlanId) - getPlanRank(floorPlanId)
  if (rankDiff < 0) {
    return {
      action: 'downgrade',
      allowed: false,
      chargeCents: 0,
      fullPriceCents,
      creditCents: 0,
      keepPaidThrough: false,
      buttonLabel: 'Plano anterior',
      hint: 'Depois de assinar, só é possível subir de plano.',
    }
  }

  const currentCycle = subscription?.billingCycle
  if (rankDiff === 0 && paidUp && currentCycle === input.cycle) {
    return {
      action: 'current',
      allowed: false,
      chargeCents: 0,
      fullPriceCents,
      creditCents: 0,
      keepPaidThrough: false,
      buttonLabel: 'Plano atual · em dia',
    }
  }

  if (
    rankDiff === 0 &&
    paidUp &&
    currentCycle &&
    BILLING_CYCLE_MONTHS[input.cycle] < BILLING_CYCLE_MONTHS[currentCycle]
  ) {
    return {
      action: 'cycle_down',
      allowed: false,
      chargeCents: 0,
      fullPriceCents,
      creditCents: 0,
      keepPaidThrough: false,
      buttonLabel: 'Indisponível agora',
      hint: 'Um período menor fica disponível na próxima renovação.',
    }
  }

  if (rankDiff > 0 && paidUp && (!currentCycle || currentCycle === input.cycle)) {
    const creditCents = getPlanPriceCents(floorPlanId, input.cycle)
    const chargeCents = Math.max(0, fullPriceCents - creditCents)
    return {
      action: 'upgrade',
      allowed: true,
      chargeCents,
      fullPriceCents,
      creditCents,
      keepPaidThrough: true,
      buttonLabel: `Subir para ${target.name}`,
      hint: `Você já tem ${getPlan(floorPlanId).name}. Paga só a diferença: ${formatMoney(chargeCents)}.`,
    }
  }

  const creditCents = paidUp ? remainingPaymentCreditCents(subscription) : 0
  const chargeCents = Math.max(0, fullPriceCents - creditCents)
  const isUpgrade = rankDiff > 0
  return {
    action: isUpgrade ? 'upgrade' : 'renew',
    allowed: true,
    chargeCents,
    fullPriceCents,
    creditCents,
    keepPaidThrough: false,
    buttonLabel: isUpgrade
      ? `Subir para ${target.name}`
      : `Renovar ${BILLING_CYCLE_LABELS[input.cycle].toLowerCase()}`,
    hint:
      creditCents > 0
        ? `Abatemos ${formatMoney(creditCents)} do período já pago. Agora: ${formatMoney(chargeCents)}.`
        : undefined,
  }
}
