export type PaymentGatewayId = 'infinitepay'

export interface CheckoutCustomer {
  name?: string
  email?: string
  phone_number?: string
}

export interface CreateCheckoutSessionInput {
  orderNsu: string
  amountCents: number
  description: string
  redirectUrl: string
  customer?: CheckoutCustomer
}

export interface CreateCheckoutSessionResult {
  checkoutUrl: string
  gatewayId: PaymentGatewayId
  slug?: string
}

export interface VerifyPaymentInput {
  orderNsu: string
  transactionNsu?: string | null
  slug?: string | null
  receiptUrl?: string | null
  captureMethod?: string | null
  rawParams?: Record<string, string | null>
}

export interface VerifyPaymentResult {
  paid: boolean
  amountCents?: number
  paidAmountCents?: number
  captureMethod?: string
  receiptUrl?: string
  transactionNsu?: string
  slug?: string
}

export interface PaymentGateway {
  id: PaymentGatewayId
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
}
