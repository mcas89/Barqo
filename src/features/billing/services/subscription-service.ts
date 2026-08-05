import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
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
import { addBillingMonths, getPlan, getPlanPriceCents } from '../plans/gates'
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
}

export async function startPlanCheckout(input: {
  organizationId: string
  planId: PlanId
  billingCycle?: BillingCycle
  customer?: CheckoutCustomer
}): Promise<{
  checkoutUrl: string
  orderNsu: string
  gatewayId: PaymentGatewayId
  slug?: string
}> {
  const cycle = input.billingCycle ?? BILLING_CYCLES.MONTHLY
  const plan = getPlan(input.planId)
  const amountCents = getPlanPriceCents(input.planId, cycle)
  const orderNsu = createId('ord').replace(/_/g, '-').slice(0, 48)
  const createdAt = nowIso()
  const gateway = getPaymentGateway()
  const order: BillingOrder = {
    id: orderNsu,
    organizationId: input.organizationId,
    planId: input.planId,
    billingCycle: cycle,
    amountCents,
    status: 'pending',
    gatewayId: gateway.id,
    createdAt,
  }

  await setDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'billing_orders', orderNsu),
    omitUndefined({ ...order }),
  )

  const redirectUrl = `${window.location.origin}/billing/retorno?balqo_order=${encodeURIComponent(orderNsu)}`
  const session = await gateway.createCheckoutSession({
    orderNsu,
    amountCents,
    description: `BALQO Plano ${plan.name} — ${formatCycleDuration(cycle)}`,
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
  const base =
    existingThrough && existingThrough.getTime() > now.getTime() ? existingThrough : now
  const paidThrough = addBillingMonths(base, months)
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
