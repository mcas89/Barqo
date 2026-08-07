import type { OrganizationId, UserId } from '../../shared/types'

export const PAYMENT_METHODS = {
  CASH: 'cash',
  PIX: 'pix',
  DEBIT: 'debit',
  CREDIT: 'credit',
  ON_ACCOUNT: 'on_account',
} as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  debit: 'Débito',
  credit: 'Crédito',
  on_account: 'Fiado',
}

export interface CartItem {
  productId: string
  name: string
  unitPriceCents: number
  /** Preço de tabela, se o unitário da venda foi ajustado */
  catalogPriceCents?: number
  costCents: number
  quantity: number
  type: 'product' | 'service'
  /** Estoque disponível no momento da inclusão (produtos) */
  availableStock?: number
  /** Item sem cadastro — não baixa estoque */
  loose?: boolean
}

export interface SalePayment {
  method: PaymentMethod
  amountCents: number
}

export interface SaleItem {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  costCents: number
  totalCents: number
  type: 'product' | 'service'
}

export interface Sale {
  id: string
  organizationId: OrganizationId
  items: SaleItem[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  payments: SalePayment[]
  changeCents: number
  status: 'completed' | 'canceled'
  soldByUserId: UserId
  soldByName: string
  createdAt: string
  /** Sessão de caixa aberta no momento da venda */
  cashSessionId: string
  /** Operador do PDV (PIN) que realizou a venda */
  operatorId: string
  /** Aparelho/terminal onde a venda foi feita */
  deviceId: string
  operatorRole?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  note?: string
  canceledAt?: string
  canceledByUserId?: UserId
  canceledByName?: string
  canceledByOperatorId?: string
  cancelReason?: string
}

export interface CompleteSaleInput {
  organizationId: OrganizationId
  items: CartItem[]
  discountCents: number
  payments: SalePayment[]
  soldByUserId: UserId
  soldByName: string
  cashSessionId: string
  operatorId: string
  deviceId: string
  operatorRole?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  note?: string
}
