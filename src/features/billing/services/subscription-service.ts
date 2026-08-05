import { collection, deleteField, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { BillingCycle, PlanId } from '../plans/types'
import {
  BILLING_CYCLE_MONTHS,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUS,
  type OrganizationSubscription,
} from '../plans/types'
import { addBillingMonths, getPlan } from '../plans/gates'
import { quotePlanCheckout } from '../plans/checkout-quote'
import { formatCycleDuration } from '../plans/messages'
import { getConfiguredPaymentGatewayId, getPaymentGateway } from '../gateways'
import type { CheckoutCustomer, PaymentGatewayId } from '../gateways'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  return db
}

export interface BillingOrder {
  id: string
  organizationId: string
  planId: PlanId
  billingCycle: BillingCycle
  amountCents: number
  status: 'pending' | 'paid'
  gatewayId: PaymentGatewayId
  createdAt: string
  paidAt?: string
  transactionNsu?: string
  slug?: string
  checkoutUrl?: string
  captureMethod?: string
  receiptUrl?: string
  checkoutKind?: 'subscribe' | 'renew' | 'upgrade'
  creditCents?: number
  fullPriceCents?: number
  keepPaidThrough?: boolean
}

export async function startPlanCheckout(input: {
  organizationId: string
  planId: PlanId
  billingCycle?: BillingCycle
  customer?: CheckoutCustomer
  subscription?: OrganizationSubscription | null
}): Promise<{
  checkoutUrl: string | null
  orderNsu: string
  gatewayId: PaymentGatewayId
  slug?: string
  immediate?: boolean
}> {
  const cycle = input.billingCycle ?? BILLING_CYCLES.MONTHLY
  const plan = getPlan(input.planId)
  const quote = quotePlanCheckout({
    subscription: input.subscription,
    targetPlanId: input.planId,
    cycle,
  })
  if (!quote.allowed) {
    throw new Error(quote.hint || 'Esta alteração de plano não está disponível.')
  }

  const amountCents = quote.chargeCents
  const orderNsu = createId('ord').replace(/_/g, '-').slice(0, 48)
  const createdAt = nowIso()
  const gateway = getPaymentGateway()
  const checkoutKind =
    quote.action === 'upgrade' ? 'upgrade' : quote.action === 'renew' ? 'renew' : 'subscribe'
  const order: BillingOrder = {
    id: orderNsu,
    organizationId: input.organizationId,
    planId: input.planId,
    billingCycle: cycle,
    amountCents,
    status: amountCents === 0 ? 'paid' : 'pending',
    gatewayId: gateway.id,
    createdAt,
    checkoutKind,
    creditCents: quote.creditCents || undefined,
    fullPriceCents: quote.fullPriceCents,
    keepPaidThrough: quote.keepPaidThrough || undefined,
    paidAt: amountCents === 0 ? createdAt : undefined,
  }

  await setDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'billing_orders', orderNsu),
    omitUndefined({ ...order }),
  )

  if (amountCents === 0) {
    await activatePaidSubscription({ organizationId: input.organizationId, order })
    return {
      checkoutUrl: null,
      orderNsu,
      gatewayId: gateway.id,
      immediate: true,
    }
  }

  const redirectUrl = `${window.location.origin}/billing/retorno?balqo_order=${encodeURIComponent(orderNsu)}`
  const upgradeLabel = quote.action === 'upgrade' ? 'Upgrade ' : ''
  const session = await gateway.createCheckoutSession({
    orderNsu,
    amountCents,
    description: `BALQO ${upgradeLabel}Plano ${plan.name} — ${formatCycleDuration(cycle)}`,
    redirectUrl,
    customer: input.customer,
  })

  await updateDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'billing_orders', orderNsu),
    omitUndefined({ slug: session.slug, checkoutUrl: session.checkoutUrl }),
  )

  return {
    checkoutUrl: session.checkoutUrl,
    orderNsu,
    gatewayId: gateway.id,
    slug: session.slug,
  }
}

export async function listBillingOrders(organizationId: string): Promise<BillingOrder[]> {
  const snap = await getDocs(
    collection(requireDb(), 'organizations', organizationId, 'billing_orders'),
  )
  return snap.docs
    .map((item) => {
      const data = item.data() as BillingOrder
      return {
        ...data,
        id: data.id || item.id,
        billingCycle: data.billingCycle ?? BILLING_CYCLES.MONTHLY,
        gatewayId: data.gatewayId ?? getConfiguredPaymentGatewayId(),
      }
    })
    .sort((left, right) => (right.paidAt ?? right.createdAt).localeCompare(left.paidAt ?? left.createdAt))
}

export async function getBillingOrder(
  organizationId: string,
  orderNsu: string,
): Promise<BillingOrder | null> {
  const snap = await getDoc(
    doc(requireDb(), 'organizations', organizationId, 'billing_orders', orderNsu),
  )
  if (!snap.exists()) return null
  const data = snap.data() as BillingOrder
  return {
    ...data,
    billingCycle: data.billingCycle ?? BILLING_CYCLES.MONTHLY,
    gatewayId: data.gatewayId ?? getConfiguredPaymentGatewayId(),
  }
}

export async function activatePaidSubscription(input: {
  organizationId: string
  order: BillingOrder
  transactionNsu?: string
  slug?: string
  captureMethod?: string
  receiptUrl?: string
  paidAmountCents?: number
}): Promise<OrganizationSubscription> {
  const paidAt = nowIso()
  const cycle = input.order.billingCycle ?? BILLING_CYCLES.MONTHLY
  const months = BILLING_CYCLE_MONTHS[cycle]

  const currentSnap = await getDoc(doc(requireDb(), 'subscriptions', input.organizationId))
  const current = currentSnap.exists()
    ? (currentSnap.data() as OrganizationSubscription)
    : null

  const now = new Date()
  const existingThrough = current?.paidThrough ? new Date(current.paidThrough) : null
  const keepPaidThrough =
    input.order.keepPaidThrough === true &&
    existingThrough !== null &&
    existingThrough.getTime() > now.getTime()
  const base =
    existingThrough && existingThrough.getTime() > now.getTime() ? existingThrough : now
  const paidThrough = keepPaidThrough ? existingThrough : addBillingMonths(base, months)
  const gatewayId = input.order.gatewayId ?? getConfiguredPaymentGatewayId()

  const subscription: OrganizationSubscription = {
    organizationId: input.organizationId,
    planId: input.order.planId,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    paidThrough: paidThrough.toISOString(),
    billingCycle: cycle,
    updatedAt: paidAt,
    lastPayment: {
      orderNsu: input.order.id,
      amountCents: input.paidAmountCents ?? input.order.amountCents,
      paidAt,
      transactionNsu: input.transactionNsu,
      slug: input.slug,
      captureMethod: input.captureMethod,
      receiptUrl: input.receiptUrl,
      billingCycle: cycle,
      gatewayId,
    },
  }

  await updateDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'billing_orders', input.order.id),
    omitUndefined({
      status: 'paid',
      paidAt,
      transactionNsu: input.transactionNsu,
      slug: input.slug,
      captureMethod: input.captureMethod,
      receiptUrl: input.receiptUrl,
      billingCycle: cycle,
      gatewayId,
    }),
  )

  await setDoc(
    doc(requireDb(), 'subscriptions', input.organizationId),
    omitUndefined({ ...subscription, graceUntil: deleteField() }),
    { merge: true },
  )

  await updateDoc(doc(requireDb(), 'organizations', input.organizationId), {
    planId: input.order.planId,
    updatedAt: paidAt,
  })

  return subscription
}
