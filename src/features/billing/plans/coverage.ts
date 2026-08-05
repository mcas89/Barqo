import { PAYMENT_GRACE_DAYS, PAYMENT_WARNING_DAYS, PLAN_CATALOG } from './catalog'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUS,
  type BillingCycle,
  type OrganizationSubscription,
  type PlanId,
  type SubscriptionStatus,
} from './types'

export type PlanNoticeTone = 'ok' | 'soon' | 'due'

export interface SubscriptionCoverage {
  planId: PlanId
  planName: string
  billingCycle?: BillingCycle
  storedStatus: SubscriptionStatus
  effectiveStatus: SubscriptionStatus
  accessUntil: Date | null
  daysRemaining: number | null
  daysOverdue: number
  graceDaysRemaining: number | null
  tone: PlanNoticeTone
  canOperate: boolean
  isPaidUp: boolean
  isTrial: boolean
  isPendingPayment: boolean
  isBlocked: boolean
  title: string
  detail: string
}

function diffLocalDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((end - start) / 86_400_000)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function daysLabel(count: number): string {
  return count === 1 ? '1 dia' : `${count} dias`
}

export function getCoverageEndDate(
  subscription: OrganizationSubscription | null | undefined,
): Date | null {
  if (!subscription) return null
  if (
    subscription.status === SUBSCRIPTION_STATUS.TRIAL &&
    subscription.trialEndsAt &&
    !subscription.paidThrough
  ) {
    return new Date(subscription.trialEndsAt)
  }
  if (subscription.paidThrough) {
    return new Date(subscription.paidThrough)
  }
  if (subscription.trialEndsAt) {
    return new Date(subscription.trialEndsAt)
  }
  return null
}

export function getSubscriptionCoverage(
  subscription: OrganizationSubscription | null | undefined,
): SubscriptionCoverage | null {
  if (!subscription) return null

  const plan = PLAN_CATALOG[subscription.planId]
  const now = new Date()
  const accessUntil = getCoverageEndDate(subscription)
  const isTrial = subscription.status === SUBSCRIPTION_STATUS.TRIAL && !subscription.paidThrough
  const isPendingPayment = !accessUntil && !isTrial
  const daysRemaining = accessUntil ? diffLocalDays(now, accessUntil) : null
  const daysOverdue = daysRemaining !== null && daysRemaining < 0 ? -daysRemaining : 0
  const inGrace = daysOverdue >= 1 && daysOverdue <= PAYMENT_GRACE_DAYS
  const graceDaysRemaining = inGrace
    ? PAYMENT_GRACE_DAYS - daysOverdue + 1
    : daysOverdue > 0
      ? 0
      : null
  const isPaidUp = daysRemaining !== null && daysRemaining >= 0
  const blockedByDate = daysOverdue > PAYMENT_GRACE_DAYS
  const storedBlocked =
    subscription.status === SUBSCRIPTION_STATUS.BLOCKED ||
    subscription.status === SUBSCRIPTION_STATUS.CANCELED
  const isBlocked = storedBlocked || blockedByDate || isPendingPayment

  let effectiveStatus: SubscriptionStatus = subscription.status
  if (isPaidUp) {
    effectiveStatus = isTrial ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE
  } else if (inGrace) {
    effectiveStatus = SUBSCRIPTION_STATUS.GRACE
  } else if (isBlocked) {
    effectiveStatus = isPendingPayment
      ? SUBSCRIPTION_STATUS.PAST_DUE
      : SUBSCRIPTION_STATUS.BLOCKED
  } else if (!isPaidUp && accessUntil) {
    effectiveStatus = SUBSCRIPTION_STATUS.PAST_DUE
  }

  const canOperate = isPaidUp || inGrace

  let tone: PlanNoticeTone = 'ok'
  if (isPendingPayment || blockedByDate || storedBlocked || inGrace || daysRemaining === 0) {
    tone = 'due'
  } else if (
    daysRemaining !== null &&
    daysRemaining > 0 &&
    daysRemaining <= PAYMENT_WARNING_DAYS
  ) {
    tone = 'soon'
  }

  const cycleLabel = subscription.billingCycle
    ? BILLING_CYCLE_LABELS[subscription.billingCycle].toLowerCase()
    : null

  let title: string
  let detail: string

  if (isPendingPayment) {
    title = `Assine o plano ${plan.name} para começar`
    detail = 'Pague o plano escolhido para liberar o PDV e as demais funções.'
  } else if ((blockedByDate || storedBlocked) && accessUntil) {
    title = `Acesso bloqueado · plano ${plan.name}`
    detail = `Venceu em ${formatDate(accessUntil)}. Pague para reativar o PDV e o sistema.`
  } else if (blockedByDate || storedBlocked) {
    title = `Acesso bloqueado · plano ${plan.name}`
    detail = 'Regularize o pagamento para voltar a usar o sistema.'
  } else if (inGrace && accessUntil) {
    title = `Plano ${plan.name} vencido há ${daysLabel(daysOverdue)}`
    detail = `Bloqueio em ${daysLabel(graceDaysRemaining ?? 0)}. Pague agora para não perder o acesso.`
  } else if (daysRemaining === 0 && accessUntil) {
    title = isTrial
      ? `Trial ${plan.name} termina hoje`
      : `Plano ${plan.name} vence hoje`
    detail = `Após o vencimento há ${PAYMENT_GRACE_DAYS} dias de prazo. Depois o PDV e as funções são bloqueados.`
  } else if (
    daysRemaining !== null &&
    daysRemaining > 0 &&
    daysRemaining <= PAYMENT_WARNING_DAYS &&
    accessUntil
  ) {
    title = isTrial
      ? `Trial ${plan.name} acaba em ${daysLabel(daysRemaining)}`
      : `Plano ${plan.name} vence em ${daysLabel(daysRemaining)}`
    detail = `${isTrial ? 'Trial até' : 'Vence em'} ${formatDate(accessUntil)}.`
  } else if (daysRemaining !== null && daysRemaining > 0 && accessUntil) {
    title = isTrial
      ? `Trial ${plan.name} · faltam ${daysLabel(daysRemaining)}`
      : `Plano ${plan.name}${cycleLabel ? ` ${cycleLabel}` : ''} · faltam ${daysLabel(daysRemaining)}`
    detail = `${isTrial ? 'Trial até' : 'Vence em'} ${formatDate(accessUntil)}.`
  } else {
    title = `Plano ${plan.name}`
    detail = 'Acompanhe o vencimento da assinatura.'
  }

  return {
    planId: subscription.planId,
    planName: plan.name,
    billingCycle: subscription.billingCycle,
    storedStatus: subscription.status,
    effectiveStatus,
    accessUntil,
    daysRemaining,
    daysOverdue,
    graceDaysRemaining,
    tone,
    canOperate,
    isPaidUp,
    isTrial,
    isPendingPayment,
    isBlocked,
    title,
    detail,
  }
}

export function isBillingCycle(value: string | null | undefined): value is BillingCycle {
  return (
    value === BILLING_CYCLES.MONTHLY ||
    value === BILLING_CYCLES.SEMIANNUAL ||
    value === BILLING_CYCLES.ANNUAL
  )
}
