import { formatDateTime } from '../../shared/lib/dates'
import { formatMoney } from '../../shared/lib/money'
import {
  normalizeWhatsappPhoneBr,
  whatsappUrl,
} from '../../shared/lib/whatsapp'
import type { Organization } from '../../shared/types'
import type { Sale } from '../pos/types'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../pos/types'

const RECENT_KEY = 'balqo.whatsapp.recentPhones'
const MAX_RECENT = 5
const MAX_ITEMS_IN_MESSAGE = 6

export function buildWhatsappReceiptMessage(input: {
  sale: Sale
  organization: Organization
  copy?: 'original' | 'segunda_via'
}): string {
  const { sale, organization } = input
  const lines: string[] = []

  lines.push(`*${organization.name}*`)
  if (input.copy === 'segunda_via') lines.push('_2ª via do comprovante_')
  lines.push(`Venda ${sale.id.slice(-8).toUpperCase()}`)
  lines.push(formatDateTime(sale.createdAt))
  lines.push(`Cliente: ${sale.customerName || 'Caixa livre'}`)
  lines.push('')

  const shown = sale.items.slice(0, MAX_ITEMS_IN_MESSAGE)
  for (const item of shown) {
    lines.push(
      `• ${item.quantity}x ${item.name} — ${formatMoney(item.totalCents)}`,
    )
  }
  const hidden = sale.items.length - shown.length
  if (hidden > 0) lines.push(`• +${hidden} item(ns)`)

  lines.push('')
  if (sale.discountCents > 0) {
    lines.push(`Desconto: ${formatMoney(sale.discountCents)}`)
  }
  lines.push(`*Total: ${formatMoney(sale.totalCents)}*`)

  for (const payment of sale.payments) {
    const label =
      PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method
    lines.push(`${label}: ${formatMoney(payment.amountCents)}`)
  }
  if (sale.changeCents > 0) {
    lines.push(`Troco: ${formatMoney(sale.changeCents)}`)
  }

  lines.push('')
  lines.push('_Comprovante de venda — não é documento fiscal_')
  if (organization.whatsapp) {
    lines.push(`Loja: ${organization.whatsapp}`)
  }

  return lines.join('\n')
}

export function openWhatsappReceipt(input: {
  phone: string
  sale: Sale
  organization: Organization
  copy?: 'original' | 'segunda_via'
}): { ok: true; phone: string } | { ok: false; error: string } {
  const phone = normalizeWhatsappPhoneBr(input.phone)
  if (!phone) {
    return {
      ok: false,
      error: 'Informe um telefone válido com DDD (ex.: 11999999999).',
    }
  }

  const text = buildWhatsappReceiptMessage({
    sale: input.sale,
    organization: input.organization,
    copy: input.copy,
  })
  const url = whatsappUrl(phone, text)

  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      window.location.assign(url)
    }
  } catch {
    window.location.assign(url)
  }

  rememberRecentWhatsappPhone(phone)
  return { ok: true, phone }
}

export function listRecentWhatsappPhones(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhatsappPhoneBr(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function rememberRecentWhatsappPhone(phone: string) {
  const normalized = normalizeWhatsappPhoneBr(phone)
  if (!normalized) return
  try {
    const next = [
      normalized,
      ...listRecentWhatsappPhones().filter((item) => item !== normalized),
    ].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // storage indisponível
  }
}
