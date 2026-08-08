import { APP_NAME } from '../../shared/constants'
import { formatDateTime } from '../../shared/lib/dates'
import { formatMoney } from '../../shared/lib/money'
import type { SaleReceiptPayload } from './types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderReceiptHtml(payload: SaleReceiptPayload): string {
  const width = payload.paperWidth === '80mm' ? '72mm' : '52mm'
  const page = payload.paperWidth
  const items = payload.items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong><br />
            <span>${item.quantity} x ${escapeHtml(formatMoney(item.unitPriceCents))}</span>
          </td>
          <td class="num">${escapeHtml(formatMoney(item.totalCents))}</td>
        </tr>`,
    )
    .join('')

  const payments = payload.payments
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(payment.label)}</td>
          <td class="num">${escapeHtml(formatMoney(payment.amountCents))}</td>
        </tr>`,
    )
    .join('')

  const logo = payload.logoDataUrl
    ? `<img class="logo" src="${payload.logoDataUrl}" alt="" />`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Comprovante ${escapeHtml(payload.saleId)}</title>
    <style>
      @page { size: ${page} auto; margin: 3mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 11px;
        color: #111;
        width: ${width};
      }
      .wrap { width: ${width}; }
      .center { text-align: center; }
      .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; margin: 0 auto 4px; display: block; }
      h1 { font-size: 13px; margin: 0 0 2px; text-transform: uppercase; }
      p { margin: 0 0 2px; }
      hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; padding: 2px 0; }
      .num { text-align: right; white-space: nowrap; }
      .muted { color: #444; font-size: 10px; }
      .total td { font-size: 12px; font-weight: 800; padding-top: 4px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      ${logo}
      <div class="center">
        <h1>${escapeHtml(payload.organizationName)}</h1>
        ${payload.organizationDocument ? `<p>${escapeHtml(payload.organizationDocument)}</p>` : ''}
        ${payload.organizationAddress ? `<p>${escapeHtml(payload.organizationAddress)}</p>` : ''}
        ${payload.organizationPhone ? `<p>${escapeHtml(payload.organizationPhone)}</p>` : ''}
        ${payload.copy === 'segunda_via' ? '<p><strong>2ª VIA</strong></p>' : ''}
      </div>
      <hr />
      <p><strong>Venda</strong> ${escapeHtml(payload.saleId.slice(-8).toUpperCase())}</p>
      <p>${escapeHtml(formatDateTime(payload.createdAt))}</p>
      <p>Operador: ${escapeHtml(payload.soldByName)}</p>
      ${payload.customerName?.trim() ? `<p>Cliente: ${escapeHtml(payload.customerName)}</p>` : '<p>Cliente: -</p>'}
      <hr />
      <table>${items}</table>
      <hr />
      <table>
        <tr><td>Subtotal</td><td class="num">${escapeHtml(formatMoney(payload.subtotalCents))}</td></tr>
        ${
          payload.discountCents > 0
            ? `<tr><td>Desconto</td><td class="num">-${escapeHtml(formatMoney(payload.discountCents))}</td></tr>`
            : ''
        }
        <tr class="total"><td>Total</td><td class="num">${escapeHtml(formatMoney(payload.totalCents))}</td></tr>
      </table>
      <hr />
      <table>${payments}</table>
      ${
        payload.changeCents > 0
          ? `<p><strong>Troco ${escapeHtml(formatMoney(payload.changeCents))}</strong></p>`
          : ''
      }
      <hr />
      <p class="center muted">Comprovante de venda · não é documento fiscal</p>
      <p class="center muted">${escapeHtml(APP_NAME)}</p>
    </div>
  </body>
</html>`
}
