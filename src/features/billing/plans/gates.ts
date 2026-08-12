import { PLAN_CATALOG, DEFAULT_PLAN_ID, ENTRADA_TRIAL_DAYS } from './catalog'
import { getSubscriptionCoverage } from './coverage'
import {
  BILLING_CYCLES,
  PLAN_IDS,
  SUBSCRIPTION_STATUS,
  type BillingCycle,
  type OrganizationSubscription,
  type PlanDefinition,
  type PlanFeature,
  type PlanId,
  type SubscriptionStatus,
} from './types'

const KNOWN_PLAN_IDS = new Set<string>(Object.values(PLAN_IDS))

/** Aceita id sujo do Firestore (vazio, typo) e devolve um PlanId válido. */
export function resolvePlanId(planId: string | null | undefined): PlanId {
  const trimmed = planId?.trim()
  if (trimmed && KNOWN_PLAN_IDS.has(trimmed)) return trimmed as PlanId
  return DEFAULT_PLAN_ID
}

export function getPlan(planId: PlanId | string | null | undefined = DEFAULT_PLAN_ID): PlanDefinition {
  const id = resolvePlanId(planId)
  return PLAN_CATALOG[id] ?? PLAN_CATALOG[DEFAULT_PLAN_ID]
}

export function planHasFeature(
  planId: PlanId | string | null | undefined,
  feature: PlanFeature,
): boolean {
  return getPlan(planId).features.includes(feature)
}

export function lowestPlanWithFeature(feature: PlanFeature): PlanDefinition | null {
  const order: PlanId[] = [
    PLAN_IDS.ENTRADA,
    PLAN_IDS.ESSENCIAL,
    PLAN_IDS.CONTROLE,
    PLAN_IDS.SALAO,
  ]
  for (const id of order) {
    if (planHasFeature(id, feature)) return getPlan(id)
  }
  return null
}

export type LimitKind = 'users' | 'devices' | 'organizations' | 'products'

export function getLimitValue(planId: PlanId, kind: LimitKind): number {
  const limits = getPlan(planId).limits
  if (kind === 'users') return limits.maxUsers
  if (kind === 'devices') return limits.maxDevices
  if (kind === 'products') return limits.maxProducts
  return limits.maxOrganizations
}

export function isWithinLimit(
  planId: PlanId,
  kind: LimitKind,
  currentCount: number,
): boolean {
  return currentCount <= getLimitValue(planId, kind)
}

export function canAddMore(
  planId: PlanId,
  kind: LimitKind,
  currentCount: number,
): boolean {
  return currentCount < getLimitValue(planId, kind)
}

/** Acesso operacional liberado (trial/active/grace). Bloqueado/cancelado trava o uso. */
export function canOperateWithStatus(status: SubscriptionStatus): boolean {
  return (
    status === SUBSCRIPTION_STATUS.TRIAL ||
    status === SUBSCRIPTION_STATUS.ACTIVE ||
    status === SUBSCRIPTION_STATUS.GRACE
  )
}

/** PAST_DUE e GRACE permitem aviso; BLOCKED/CANCELED não. */
export function shouldShowPaymentWarning(status: SubscriptionStatus): boolean {
  return (
    status === SUBSCRIPTION_STATUS.PAST_DUE || status === SUBSCRIPTION_STATUS.GRACE
  )
}

export function isSubscriptionBlocked(status: SubscriptionStatus): boolean {
  return (
    status === SUBSCRIPTION_STATUS.BLOCKED || status === SUBSCRIPTION_STATUS.CANCELED
  )
}

/** Trial válido ou ciclo pago até a data de vencimento (sem contar carência). */
export function isPlanPaidUp(subscription: OrganizationSubscription | null | undefined): boolean {
  return getSubscriptionCoverage(subscription)?.isPaidUp === true
}

export function getPlanPriceCents(planId: PlanId, cycle: BillingCycle = BILLING_CYCLES.MONTHLY): number {
  const plan = getPlan(planId)
  if (cycle === BILLING_CYCLES.ANNUAL) return plan.priceAnnualCents
  if (cycle === BILLING_CYCLES.SEMIANNUAL) return plan.priceSemiannualCents
  return plan.priceMonthlyCents
}

export function addBillingMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime())
  next.setMonth(next.getMonth() + months)
  return next
}

export function createDefaultSubscription(
  organizationId: string,
  planId: PlanId = DEFAULT_PLAN_ID,
): OrganizationSubscription {
  const updatedAt = new Date().toISOString()

  if (planId === PLAN_IDS.ENTRADA) {
    const trialEnds = new Date()
    trialEnds.setDate(trialEnds.getDate() + ENTRADA_TRIAL_DAYS)
    return {
      organizationId,
      planId,
      status: SUBSCRIPTION_STATUS.TRIAL,
      trialEndsAt: trialEnds.toISOString(),
      updatedAt,
    }
  }

  return {
    organizationId,
    planId,
    status: SUBSCRIPTION_STATUS.PAST_DUE,
    updatedAt,
  }
}

export function assertFeatureAccess(
  planId: PlanId,
  feature: PlanFeature,
): { allowed: boolean; requiredPlan: PlanDefinition | null } {
  if (planHasFeature(planId, feature)) {
    return { allowed: true, requiredPlan: null }
  }
  return { allowed: false, requiredPlan: lowestPlanWithFeature(feature) }
}
