import { formatDateTime } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import type { Quote } from '../services/quote-service'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatQty(quantity: number, unit?: string): string {
  const qty = quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
  return unit ? `${qty} ${unit.toLowerCase()}` : qty
}

export function renderQuoteHtml(input: {
  quote: Quote
  organizationName: string
  organizationDocument?: string
  organizationAddress?: string
  organizationPhone?: string
  logoDataUrl?: string
}): string {
  const { quote } = input
  const items = quote.items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong><br />
            <span>${escapeHtml(formatQty(item.quantity, item.unit))} × ${escapeHtml(formatMoney(item.unitPriceCents))}</span>
          </td>
          <td class="num">${escapeHtml(formatMoney(item.totalCents))}</td>
        </tr>`,
    )
    .join('')

  const logo = input.logoDataUrl
    ? `<img class="logo" src="${input.logoDataUrl}" alt="" />`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Orçamento ${escapeHtml(quote.id.slice(-8).toUpperCase())}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        color: #111;
      }
      .wrap { max-width: 720px; margin: 0 auto; }
      .center { text-align: center; }
      .logo { max-width: 160px; max-height: 64px; object-fit: contain; margin: 0 auto 8px; display: block; }
      h1 { font-size: 18px; margin: 0 0 4px; text-transform: uppercase; }
      h2 { font-size: 15px; margin: 12px 0 6px; color: #0b1f3a; }
      p { margin: 0 0 3px; }
      hr { border: none; border-top: 1px dashed #333; margin: 10px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
      .num { text-align: right; white-space: nowrap; }
      .muted { color: #555; font-size: 12px; }
      .total td { font-size: 15px; font-weight: 800; border-bottom: none; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${logo}
      <div class="center">
        <h1>${escapeHtml(input.organizationName)}</h1>
        ${input.organizationDocument ? `<p>${escapeHtml(input.organizationDocument)}</p>` : ''}
        ${input.organizationAddress ? `<p>${escapeHtml(input.organizationAddress)}</p>` : ''}
        ${input.organizationPhone ? `<p>${escapeHtml(input.organizationPhone)}</p>` : ''}
        <h2>ORÇAMENTO</h2>
      </div>
      <hr />
      <p>Nº ${escapeHtml(quote.id.slice(-8).toUpperCase())}</p>
      <p>${escapeHtml(formatDateTime(quote.createdAt))}</p>
      <p>Operador: ${escapeHtml(quote.createdByName)}</p>
      <p>Cliente: ${escapeHtml(quote.customerName?.trim() || '—')}</p>
      <hr />
      <table>
        <tbody>
          ${items}
          <tr><td>Subtotal</td><td class="num">${escapeHtml(formatMoney(quote.subtotalCents))}</td></tr>
          ${
            quote.discountCents > 0
              ? `<tr><td>Desconto</td><td class="num">${escapeHtml(formatMoney(quote.discountCents))}</td></tr>`
              : ''
          }
          <tr class="total"><td>TOTAL</td><td class="num">${escapeHtml(formatMoney(quote.totalCents))}</td></tr>
        </tbody>
      </table>
      <hr />
      <p class="muted">Documento de orçamento — não é comprovante de venda nem documento fiscal.</p>
      <p class="muted">Valores sujeitos a alteração até a confirmação da venda.</p>
    </div>
    <script>window.onload = function () { window.print(); }</script>
  </body>
</html>`
}

export function renderQuoteText(quote: Quote, organizationName: string): string {
  const lines = [
    organizationName.toUpperCase(),
    'ORÇAMENTO',
    `Nº ${quote.id.slice(-8).toUpperCase()}`,
    formatDateTime(quote.createdAt),
    `Cliente: ${quote.customerName?.trim() || '—'}`,
    '---',
  ]
  for (const item of quote.items) {
    const qty = item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    const unit = item.unit ? ` ${item.unit.toLowerCase()}` : ''
    lines.push(`${item.name}`)
    lines.push(`${qty}${unit} x ${formatMoney(item.unitPriceCents)} = ${formatMoney(item.totalCents)}`)
  }
  lines.push('---')
  lines.push(`TOTAL: ${formatMoney(quote.totalCents)}`)
  lines.push('Orçamento — não é venda/fiscal.')
  return lines.join('\n')
}

export function openQuotePrintWindow(html: string): void {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900')
  if (!popup) {
    throw new Error('Permita pop-ups para imprimir o orçamento.')
  }
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}
