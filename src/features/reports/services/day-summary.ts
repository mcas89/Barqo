import type { PaymentMethod, Sale } from '../../pos/types'
import { PAYMENT_METHODS } from '../../pos/types'
import type { Product } from '../../products'
import { formatProductStockLabel, readBottleStock, usesBottleStockModel } from '../../products'
import type { ActorNameMap } from './actor-names'

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
  stockLabel: string
  minStock: number
}

export interface DaySummary {
  fromIso: string
  salesCount: number
  salesTotalCents: number
  /** Fiado do dia — a receber, não é dinheiro na gaveta. */
  fiadoCents: number
  /** Total vendido menos fiado. */
  receivedCents: number
  ticketAverageCents: number
  changeTotalCents: number
  payments: DayPaymentBreakdown[]
  topProducts: DayTopProduct[]
  recentSales: Sale[]
  lowStock: LowStockAlert[]
  cashOpen: boolean
  cashOpenedByName?: string
  actorNames?: ActorNameMap
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
  actorNames?: ActorNameMap
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

  const fiadoCents = paymentsMap[PAYMENT_METHODS.ON_ACCOUNT]
  const receivedCents = Math.max(0, salesTotalCents - fiadoCents)

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
    .filter((product) => {
      if (!product.active || product.type !== 'product' || product.minStock <= 0) {
        return false
      }
      const sealed = usesBottleStockModel(product)
        ? readBottleStock(product).sealed
        : product.stock
      return sealed <= product.minStock
    })
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: usesBottleStockModel(product)
        ? readBottleStock(product).sealed
        : product.stock,
      stockLabel: formatProductStockLabel(product, input.products),
      minStock: product.minStock,
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)

  return {
    fromIso: input.fromIso,
    salesCount,
    salesTotalCents,
    fiadoCents,
    receivedCents,
    ticketAverageCents,
    changeTotalCents,
    payments,
    topProducts,
    recentSales,
    lowStock,
    cashOpen: input.cashOpen,
    cashOpenedByName: input.cashOpenedByName,
    actorNames: input.actorNames,
  }
}
