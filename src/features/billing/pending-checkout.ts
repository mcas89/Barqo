import type { BillingCycle, PlanId } from './plans/types'
import type { PaymentGatewayId } from './gateways/types'

export const PENDING_CHECKOUT_KEY = 'balqo.pendingCheckout'
export const BILLING_CHANNEL_NAME = 'balqo-billing'

export interface PendingCheckout {
  organizationId: string
  orderNsu: string
  planId: PlanId
  billingCycle: BillingCycle
  checkoutUrl: string
  gatewayId: PaymentGatewayId
  slug?: string
  startedAt: string
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = localStorage.getItem(PENDING_CHECKOUT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingCheckout
    if (!parsed?.organizationId || !parsed.orderNsu) return null
    return parsed
  } catch {
    return null
  }
}

export function writePendingCheckout(pending: PendingCheckout) {
  localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending))
  window.dispatchEvent(new Event('balqo-pending-checkout'))
}

export function clearPendingCheckout() {
  localStorage.removeItem(PENDING_CHECKOUT_KEY)
  window.dispatchEvent(new Event('balqo-pending-checkout'))
}

export function publishBillingPaid(orderNsu: string) {
  try {
    const channel = new BroadcastChannel(BILLING_CHANNEL_NAME)
    channel.postMessage({ type: 'paid', orderNsu })
    channel.close()
  } catch {
    localStorage.setItem('balqo.billingPaidAt', String(Date.now()))
  }
}
