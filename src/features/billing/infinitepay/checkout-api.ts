import { INFINITEPAY_CHECK_URL, INFINITEPAY_LINKS_URL, getInfinitePayHandle } from './config'

export interface InfinitePayCustomer {
  name?: string
  email?: string
  phone_number?: string
}

export interface CreateCheckoutLinkInput {
  orderNsu: string
  amountCents: number
  description: string
  redirectUrl: string
  customer?: InfinitePayCustomer
}

export interface PaymentCheckResult {
  success: boolean
  paid: boolean
  amount?: number
  paidAmount?: number
  installments?: number
  captureMethod?: string
}

export function extractInfinitePaySlug(url: string, data?: Record<string, unknown>): string | undefined {
  const fromPayload = [data?.invoice_slug, data?.slug, data?.invoiceSlug]
    .find((value) => typeof value === 'string' && value.trim().length > 0)
  if (typeof fromPayload === 'string') return fromPayload.trim()

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const last = parts.at(-1)
    if (last && last.length >= 6 && !['links', 'checkout', 'pay', 'invoice'].includes(last)) {
      return last
    }
  } catch {
    return undefined
  }
  return undefined
}

export async function createInfinitePayCheckoutLink(
  input: CreateCheckoutLinkInput,
): Promise<{ url: string; slug?: string }> {
  const handle = getInfinitePayHandle()
  const response = await fetch(INFINITEPAY_LINKS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: input.orderNsu,
      redirect_url: input.redirectUrl,
      items: [
        {
          quantity: 1,
          price: input.amountCents,
          description: input.description,
        },
      ],
      customer: input.customer,
    }),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      'Não foi possível gerar o checkout InfinitePay.'
    throw new Error(message)
  }

  const url =
    (typeof data.url === 'string' && data.url) ||
    (typeof data.checkout_url === 'string' && data.checkout_url) ||
    (typeof data.link === 'string' && data.link)

  if (!url) {
    throw new Error('InfinitePay não retornou o link de pagamento.')
  }

  return { url, slug: extractInfinitePaySlug(url, data) }
}

export async function checkInfinitePayPayment(input: {
  orderNsu: string
  transactionNsu?: string
  slug?: string
}): Promise<PaymentCheckResult> {
  const handle = getInfinitePayHandle()
  const response = await fetch(INFINITEPAY_CHECK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: input.orderNsu,
      ...(input.transactionNsu ? { transaction_nsu: input.transactionNsu } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
    }),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new Error('Não foi possível confirmar o pagamento na InfinitePay.')
  }

  return {
    success: data.success === true,
    paid: data.paid === true,
    amount: typeof data.amount === 'number' ? data.amount : undefined,
    paidAmount: typeof data.paid_amount === 'number' ? data.paid_amount : undefined,
    installments: typeof data.installments === 'number' ? data.installments : undefined,
    captureMethod:
      typeof data.capture_method === 'string' ? data.capture_method : undefined,
  }
}
