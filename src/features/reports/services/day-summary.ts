import type { PaymentMethod, Sale } from '../../pos/types'
import { PAYMENT_METHODS } from '../../pos/types'
import type { Product } from '../../products'

export interface DayPaymentBreakdown {
  method: PaymentMethod
  amountCents: number
}

export interface DayTopProduct {
  productId: string
  name: string
  quantity: number
  totalCents: number
}

export interface LowStockAlert {
  id: string
  name: string
  stock: number
  minStock: number
}

export interface DaySummary {
  fromIso: string
  salesCount: number
  salesTotalCents: number
  ticketAverageCents: number
  changeTotalCents: number
  payments: DayPaymentBreakdown[]
  topProducts: DayTopProduct[]
  recentSales: Sale[]
  lowStock: LowStockAlert[]
  cashOpen: boolean
  cashOpenedByName?: string
}

function emptyPayments(): Record<PaymentMethod, number> {
  return {
    [PAYMENT_METHODS.CASH]: 0,
    [PAYMENT_METHODS.PIX]: 0,
    [PAYMENT_METHODS.DEBIT]: 0,
    [PAYMENT_METHODS.CREDIT]: 0,
    [PAYMENT_METHODS.ON_ACCOUNT]: 0,
  }
}

export function buildDaySummary(input: {
  fromIso: string
  sales: Sale[]
  products: Product[]
  cashOpen: boolean
  cashOpenedByName?: string
}): DaySummary {
  const paymentsMap = emptyPayments()
  let salesTotalCents = 0
  let changeTotalCents = 0
  const productMap = new Map<string, DayTopProduct>()

  for (const sale of input.sales) {
    salesTotalCents += sale.totalCents ?? 0
    changeTotalCents += sale.changeCents ?? 0

    for (const payment of sale.payments ?? []) {
      if (payment.method in paymentsMap) {
        paymentsMap[payment.method] += payment.amountCents ?? 0
      }
    }

    for (const item of sale.items ?? []) {
      const current = productMap.get(item.productId)
      if (current) {
        current.quantity += item.quantity
        current.totalCents += item.totalCents
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          totalCents: item.totalCents,
        })
      }
    }
  }

  const salesCount = input.sales.length
  const ticketAverageCents =
    salesCount > 0 ? Math.round(salesTotalCents / salesCount) : 0

  const payments: DayPaymentBreakdown[] = (
    Object.keys(paymentsMap) as PaymentMethod[]
  )
    .map((method) => ({ method, amountCents: paymentsMap[method] }))
    .filter((row) => row.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents)

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity || b.totalCents - a.totalCents)
    .slice(0, 5)

  const recentSales = [...input.sales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  const lowStock = input.products
    .filter(
      (product) =>
        product.active &&
        product.type === 'product' &&
        product.minStock > 0 &&
        product.stock <= product.minStock,
    )
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minStock: product.minStock,
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)

  return {
    fromIso: input.fromIso,
    salesCount,
    salesTotalCents,
    ticketAverageCents,
    changeTotalCents,
    payments,
    topProducts,
    recentSales,
    lowStock,
    cashOpen: input.cashOpen,
    cashOpenedByName: input.cashOpenedByName,
  }
}
