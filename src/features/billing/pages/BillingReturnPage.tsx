import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { APP_NAME, BALQO_LOGO_SRC, BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { formatMoney } from '../../../shared/lib/money'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDocumentTheme } from '../../../shared/hooks/useDocumentTheme'
import { getPaymentGateway } from '../gateways'
import {
  activatePaidSubscription,
  getBillingOrder,
} from '../services/subscription-service'
import { clearPendingCheckout, publishBillingPaid } from '../pending-checkout'
import { formatCycleDuration, getPlan } from '../plans'
import './BillingReturnPage.css'

export function BillingReturnPage() {
  const [params] = useSearchParams()
  const { organization, user, refreshSession } = useAuth()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('Confirmando pagamento…')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [orderNsu, setOrderNsu] = useState<string | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)

  useDocumentTheme(organization?.themeColor)

  const queryKey = params.toString()

  useEffect(() => {
    let cancelled = false

    async function confirm() {
      const nextOrderNsu = params.get('order_nsu') ?? params.get('balqo_order')
      const transactionNsu = params.get('transaction_nsu')
      const slug = params.get('slug')
      const captureMethod = params.get('capture_method') ?? undefined
      const receipt = params.get('receipt_url')
      setOrderNsu(nextOrderNsu)

      if (!organization?.id) {
        setStatus('error')
        setMessage('Faça login na loja para confirmar o pagamento.')
        return
      }

      if (!nextOrderNsu) {
        setStatus('error')
        setMessage('Retorno incompleto do pagamento. Tente pagar de novo em Planos.')
        return
      }

      try {
        const order = await getBillingOrder(organization.id, nextOrderNsu)
        if (!order) {
          throw new Error('Pedido não encontrado nesta loja.')
        }
        if (!cancelled) setPlanName(getPlan(order.planId).name)

        if (order.status === 'paid') {
          clearPendingCheckout()
          publishBillingPaid(order.id)
          if (!cancelled) {
            setStatus('ok')
            setMessage(
              `Plano ${getPlan(order.planId).name} já estava ativo (${formatCycleDuration(order.billingCycle)}).`,
            )
            setReceiptUrl(receipt)
          }
          return
        }

        const gateway = getPaymentGateway(order.gatewayId)
        const check = await gateway.verifyPayment({
          orderNsu: nextOrderNsu,
          transactionNsu,
          slug: slug ?? order.slug,
          receiptUrl: receipt,
          captureMethod,
          rawParams: {
            order_nsu: nextOrderNsu,
            transaction_nsu: transactionNsu,
            slug: slug ?? order.slug ?? null,
            receipt_url: receipt,
            capture_method: captureMethod ?? null,
          },
        })

        if (!check.paid) {
          throw new Error(
            'Pagamento ainda não confirmado. Se já pagou, envie o comprovante no WhatsApp para liberarmos o plano.',
          )
        }

        await activatePaidSubscription({
          organizationId: organization.id,
          order,
          transactionNsu: check.transactionNsu ?? transactionNsu ?? undefined,
          slug: check.slug ?? slug ?? undefined,
          captureMethod: check.captureMethod ?? captureMethod,
          receiptUrl: check.receiptUrl ?? receipt ?? undefined,
          paidAmountCents: check.paidAmountCents ?? check.amountCents,
        })
        await refreshSession()
        clearPendingCheckout()
        publishBillingPaid(order.id)

        if (!cancelled) {
          setStatus('ok')
          setMessage(
            `Pagamento confirmado. Plano ${getPlan(order.planId).name} ativo por ${formatCycleDuration(order.billingCycle)}${
              check.paidAmountCents || check.amountCents
                ? ` · ${formatMoney(check.paidAmountCents ?? check.amountCents ?? 0)}`
                : ''
            }.`,
          )
          setReceiptUrl(check.receiptUrl ?? receipt)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.')
        }
      }
    }

    void confirm()
    return () => {
      cancelled = true
    }
  }, [organization?.id, queryKey, refreshSession, params])

  const supportText = [
    'Olá, paguei o plano BALQO e a confirmação automática não concluiu.',
    `Loja: ${organization?.name ?? '—'}`,
    `Nome: ${user?.displayName ?? '—'}`,
    planName ? `Plano: ${planName}` : null,
    orderNsu ? `Pedido: ${orderNsu}` : null,
    'Segue o comprovante para liberação do plano.',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <main className="billing-return">
      <img src={BALQO_LOGO_SRC} alt={APP_NAME} />
      <section>
        <p className="billing-return__eyebrow">Pagamento</p>
        <h1>
          {status === 'loading'
            ? 'Confirmando…'
            : status === 'ok'
              ? 'Pagamento aprovado'
              : 'Não confirmado'}
        </h1>
        <p>{message}</p>
        <div className="billing-return__actions">
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noreferrer">
              Ver comprovante
            </a>
          )}
          {status === 'error' && (
            <a
              className="billing-return__whatsapp"
              href={whatsappUrl(BALQO_SUPPORT_WHATSAPP, supportText)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp — enviar comprovante
            </a>
          )}
          <Link to="/app/billing">Ir para planos</Link>
          <Link to="/app">Abrir o sistema</Link>
        </div>
      </section>
    </main>
  )
}
