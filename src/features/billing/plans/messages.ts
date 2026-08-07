import { formatMoney } from '../../../shared/lib/money'
import {
  getPlan,
  getPlanPriceCents,
  lowestPlanWithFeature,
  type LimitKind,
} from './gates'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_MONTHS,
  BILLING_CYCLES,
  type BillingCycle,
  type PlanFeature,
  type PlanId,
} from './types'

export function formatPlanPrice(
  planId: PlanId,
  cycle: BillingCycle = BILLING_CYCLES.MONTHLY,
): string {
  const cents = getPlanPriceCents(planId, cycle)
  if (cycle === BILLING_CYCLES.MONTHLY) {
    return `${formatMoney(cents)}/mês`
  }
  return `${formatMoney(cents)} · ${BILLING_CYCLE_LABELS[cycle].toLowerCase()}`
}

export function formatCycleDuration(cycle: BillingCycle): string {
  const months = BILLING_CYCLE_MONTHS[cycle]
  return months === 1 ? '1 mês' : `${months} meses`
}

export function equivalentMonthlyCents(planId: PlanId, cycle: BillingCycle): number {
  const months = BILLING_CYCLE_MONTHS[cycle]
  return Math.round(getPlanPriceCents(planId, cycle) / months)
}

export function upgradeMessageForFeature(feature: PlanFeature): string {
  const plan = lowestPlanWithFeature(feature)
  if (!plan) {
    return 'Este recurso não está disponível nos planos atuais.'
  }
  return `Disponível a partir do plano ${plan.name} (${formatPlanPrice(plan.id)}).`
}

export function upgradeMessageForLimit(kind: LimitKind, planId: PlanId): string {
  const current = getPlan(planId)
  const labels: Record<LimitKind, string> = {
    users: 'usuários',
    devices: 'dispositivos',
    organizations: 'lojas',
    products: 'produtos',
  }

  if (planId === 'controle') {
    return `Limite de ${labels[kind]} do plano ${current.name} atingido. Fale com o suporte BALQO.`
  }

  const nextId: PlanId = planId === 'entrada' ? 'essencial' : 'controle'
  const next = getPlan(nextId)
  return `Limite de ${labels[kind]} do plano ${current.name} atingido. Faça upgrade para ${next.name} (${formatPlanPrice(next.id)}).`
}

export function planComparisonHint(planId: PlanId): string {
  return getPlan(planId).growthPain
}
