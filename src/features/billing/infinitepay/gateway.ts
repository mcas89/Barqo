import { checkInfinitePayPayment, createInfinitePayCheckoutLink } from './checkout-api'
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  PaymentGateway,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '../gateways/types'

export const infinitePayGateway: PaymentGateway = {
  id: 'infinitepay',

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const { url, slug } = await createInfinitePayCheckoutLink(input)
    return { checkoutUrl: url, gatewayId: 'infinitepay', slug }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const orderNsu = input.orderNsu
    const transactionNsu = input.transactionNsu ?? input.rawParams?.transaction_nsu ?? undefined
    const slug = input.slug ?? input.rawParams?.slug ?? undefined

    const check = await checkInfinitePayPayment({
      orderNsu,
      transactionNsu: transactionNsu || undefined,
      slug: slug || undefined,
    })

    return {
      paid: check.paid,
      amountCents: check.amount,
      paidAmountCents: check.paidAmount,
      captureMethod: check.captureMethod ?? input.captureMethod ?? undefined,
      receiptUrl: input.receiptUrl ?? input.rawParams?.receipt_url ?? undefined,
      transactionNsu: transactionNsu || undefined,
      slug: slug || undefined,
    }
  },
}
