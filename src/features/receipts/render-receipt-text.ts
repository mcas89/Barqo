import { formatDateTime } from '../../shared/lib/dates'
import { formatMoney } from '../../shared/lib/money'
import type { SaleReceiptPayload } from './types'

function line(width: number, char = '-'): string {
  return char.repeat(width)
}

function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const rows: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= width) {
      current = next
      continue
    }
    if (current) rows.push(current)
    current = word.length <= width ? word : word.slice(0, width)
  }
  if (current) rows.push(current)
  return rows.length ? rows : ['']
}

export function renderReceiptText(payload: SaleReceiptPayload): string {
  const width = payload.paperWidth === '80mm' ? 48 : 32
  const rows: string[] = []

  rows.push(...wrap(payload.organizationName.toUpperCase(), width))
  if (payload.organizationDocument) rows.push(...wrap(payload.organizationDocument, width))
  if (payload.organizationAddress) rows.push(...wrap(payload.organizationAddress, width))
  if (payload.organizationPhone) rows.push(...wrap(payload.organizationPhone, width))
  if (payload.copy === 'segunda_via') rows.push('*** 2A VIA ***')
  rows.push(line(width))
  rows.push(`Venda ${payload.saleId.slice(-8).toUpperCase()}`)
  rows.push(formatDateTime(payload.createdAt))
  rows.push(...wrap(`Operador: ${payload.soldByName}`, width))
  rows.push(...wrap(`Cliente: ${payload.customerName || 'Caixa livre'}`, width))
  rows.push(line(width))

  for (const item of payload.items) {
    rows.push(...wrap(item.name, width))
    const left = `${item.quantity} x ${formatMoney(item.unitPriceCents)}`
    const right = formatMoney(item.totalCents)
    const gap = Math.max(1, width - left.length - right.length)
    rows.push(`${left}${' '.repeat(gap)}${right}`)
  }

  rows.push(line(width))
  const pushMoney = (label: string, cents: number) => {
    const right = formatMoney(cents)
    const gap = Math.max(1, width - label.length - right.length)
    rows.push(`${label}${' '.repeat(gap)}${right}`)
  }
  pushMoney('Subtotal', payload.subtotalCents)
  if (payload.discountCents > 0) pushMoney('Desconto', payload.discountCents)
  pushMoney('TOTAL', payload.totalCents)
  rows.push(line(width))
  for (const payment of payload.payments) {
    pushMoney(payment.label, payment.amountCents)
  }
  if (payload.changeCents > 0) pushMoney('Troco', payload.changeCents)
  rows.push(line(width))
  rows.push(...wrap('Comprovante de venda', width))
  rows.push(...wrap('Nao e documento fiscal', width))
  rows.push('')
  rows.push('')
  rows.push('')
  return rows.join('\r\n')
}
