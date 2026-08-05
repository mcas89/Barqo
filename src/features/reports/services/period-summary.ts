import type { PaymentMethod, Sale } from '../../pos/types'
import { PAYMENT_METHODS } from '../../pos/types'

export interface PeriodPaymentBreakdown {
  method: PaymentMethod
  amountCents: number
}

export interface PeriodProductRow {
  productId: string
  name: string
  quantity: number
  totalCents: number
}

export interface PeriodOperatorRow {
  key: string
  name: string
  salesCount: number
  totalCents: number
}

export interface PeriodSummary {
  fromIso: string
  toIso: string
  salesCount: number
  salesTotalCents: number
  ticketAverageCents: number
  changeTotalCents: number
  fiadoCents: number
  payments: PeriodPaymentBreakdown[]
  products: PeriodProductRow[]
  operators: PeriodOperatorRow[]
  sales: Sale[]
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

export function buildPeriodSummary(input: {
  fromIso: string
  toIso: string
  sales: Sale[]
}): PeriodSummary {
  const paymentsMap = emptyPayments()
  let salesTotalCents = 0
  let changeTotalCents = 0
  const productMap = new Map<string, PeriodProductRow>()
  const operatorMap = new Map<string, PeriodOperatorRow>()

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

    const operatorKey = sale.operatorId || sale.soldByUserId || 'sem-operador'
    const operatorName = sale.soldByName || 'Sem operador'
    const operator = operatorMap.get(operatorKey)
    if (operator) {
      operator.salesCount += 1
      operator.totalCents += sale.totalCents ?? 0
    } else {
      operatorMap.set(operatorKey, {
        key: operatorKey,
        name: operatorName,
        salesCount: 1,
        totalCents: sale.totalCents ?? 0,
      })
    }
  }

  const salesCount = input.sales.length

  return {
    fromIso: input.fromIso,
    toIso: input.toIso,
    salesCount,
    salesTotalCents,
    ticketAverageCents:
      salesCount > 0 ? Math.round(salesTotalCents / salesCount) : 0,
    changeTotalCents,
    fiadoCents: paymentsMap[PAYMENT_METHODS.ON_ACCOUNT],
    payments: (Object.keys(paymentsMap) as PaymentMethod[])
      .map((method) => ({ method, amountCents: paymentsMap[method] }))
      .filter((row) => row.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents),
    products: Array.from(productMap.values())
      .sort((a, b) => b.totalCents - a.totalCents || b.quantity - a.quantity)
      .slice(0, 20),
    operators: Array.from(operatorMap.values()).sort(
      (a, b) => b.totalCents - a.totalCents,
    ),
    sales: [...input.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

export function periodSummaryToCsv(summary: PeriodSummary): string {
  const lines = [
    'tipo,nome,quantidade,total_centavos',
    `resumo,vendas,${summary.salesCount},${summary.salesTotalCents}`,
    `resumo,ticket_medio,1,${summary.ticketAverageCents}`,
    ...summary.payments.map(
      (row) => `pagamento,${row.method},,${row.amountCents}`,
    ),
    ...summary.operators.map(
      (row) => `operador,${csvEscape(row.name)},${row.salesCount},${row.totalCents}`,
    ),
    ...summary.products.map(
      (row) => `produto,${csvEscape(row.name)},${row.quantity},${row.totalCents}`,
    ),
  ]
  return lines.join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
