import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getPaymentGateway } from '../gateways'
import {
  BILLING_CHANNEL_NAME,
  clearPendingCheckout,
  readPendingCheckout,
  type PendingCheckout,
} from '../pending-checkout'
import {
  activatePaidSubscription,
  getBillingOrder,
  type BillingOrder,
} from '../services/subscription-service'

const POLL_MS = 8000
const MAX_WAIT_MS = 45 * 60 * 1000

export function usePendingCheckout(): PendingCheckout | null {
  const [pending, setPending] = useState<PendingCheckout | null>(() => readPendingCheckout())

  useEffect(() => {
    function sync() {
      setPending(readPendingCheckout())
    }
    window.addEventListener('storage', sync)
    window.addEventListener('balqo-pending-checkout', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('balqo-pending-checkout', sync)
    }
  }, [])

  return pending
}

export function PendingCheckoutWatcher() {
  const { organization, refreshSession } = useAuth()
  const pending = usePendingCheckout()

  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || !pending || pending.organizationId !== orgId) return

    const db = getFirestoreDb()
    if (!db) return

    let cancelled = false

    async function activateFromOrder(order: BillingOrder, extras?: {
      transactionNsu?: string
      slug?: string
      captureMethod?: string
      receiptUrl?: string
      paidAmountCents?: number
    }) {
      if (order.status !== 'paid') {
        await activatePaidSubscription({
          organizationId: orgId!,
          order,
          transactionNsu: extras?.transactionNsu,
          slug: extras?.slug ?? order.slug,
          captureMethod: extras?.captureMethod,
          receiptUrl: extras?.receiptUrl,
          paidAmountCents: extras?.paidAmountCents,
        })
      }
      clearPendingCheckout()
      await refreshSession()
    }

    async function pollOnce() {
      const current = readPendingCheckout()
      if (!current || current.organizationId !== orgId) return
      if (Date.now() - Date.parse(current.startedAt) > MAX_WAIT_MS) return

      const order = await getBillingOrder(orgId!, current.orderNsu)
      if (!order || cancelled) return
      if (order.status === 'paid') {
        clearPendingCheckout()
        await refreshSession()
        return
      }

      try {
        const gateway = getPaymentGateway(order.gatewayId)
        const check = await gateway.verifyPayment({
          orderNsu: order.id,
          slug: current.slug ?? order.slug,
        })
        if (!check.paid || cancelled) return
        await activateFromOrder(order, {
          transactionNsu: check.transactionNsu,
          slug: check.slug ?? current.slug ?? order.slug,
          captureMethod: check.captureMethod,
          receiptUrl: check.receiptUrl,
          paidAmountCents: check.paidAmountCents ?? check.amountCents,
        })
      } catch {
        // InfinitePay pode recusar consulta sem transaction_nsu; o retorno/aba ainda confirma.
      }
    }

    const unsub = onSnapshot(
      doc(db, 'organizations', orgId, 'billing_orders', pending.orderNsu),
      (snap) => {
        if (!snap.exists() || cancelled) return
        const order = snap.data() as BillingOrder
        if (order.status === 'paid') {
          clearPendingCheckout()
          void refreshSession()
        }
      },
    )

    void pollOnce()
    const timer = window.setInterval(() => void pollOnce(), POLL_MS)

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(BILLING_CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<{ type?: string; orderNsu?: string }>) => {
        if (event.data?.type === 'paid') {
          clearPendingCheckout()
          void refreshSession()
        }
      }
    } catch {
      channel = null
    }

    return () => {
      cancelled = true
      unsub()
      window.clearInterval(timer)
      channel?.close()
    }
  }, [organization?.id, pending?.orderNsu, pending?.organizationId, refreshSession, pending])

  return null
}
