import { infinitePayGateway } from '../infinitepay/gateway'
import type { PaymentGateway, PaymentGatewayId } from './types'

const GATEWAYS: Record<PaymentGatewayId, PaymentGateway> = {
  infinitepay: infinitePayGateway,
}

export function getConfiguredPaymentGatewayId(): PaymentGatewayId {
  const raw = (import.meta.env.VITE_PAYMENT_GATEWAY as string | undefined)?.trim().toLowerCase()
  if (!raw || raw === 'infinitepay') return 'infinitepay'
  if (raw in GATEWAYS) return raw as PaymentGatewayId
  throw new Error(`Gateway de pagamento não suportado: ${raw}`)
}

export function getPaymentGateway(
  id: PaymentGatewayId = getConfiguredPaymentGatewayId(),
): PaymentGateway {
  const gateway = GATEWAYS[id]
  if (!gateway) {
    throw new Error(`Gateway de pagamento não registrado: ${id}`)
  }
  return gateway
}
