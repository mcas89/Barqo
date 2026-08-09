import { buildSaleReceipt } from './build-receipt'
import { enqueueReceiptDelivery, flushReceiptOutbox } from './outbox'
import { BROWSER_PRINT_VALUE, printRawText } from './qz-client'
import { renderReceiptHtml } from './render-receipt-html'
import { renderReceiptText } from './render-receipt-text'
import { resolveReceiptSettings } from './settings'
import type {
  BuildReceiptInput,
  ReceiptDeliveryResult,
  ReceiptSettings,
  SaleReceiptPayload,
} from './types'

function printViaBrowser(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc) {
    frame.remove()
    throw new Error('Não foi possível abrir a impressão.')
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 1500)
  }

  window.setTimeout(() => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } finally {
      cleanup()
    }
  }, 250)
}

async function printViaQz(
  payload: SaleReceiptPayload,
  settings: ReceiptSettings,
): Promise<boolean> {
  const printerPath = (settings.printerPath || payload.printerPath || '').trim()
  if (!printerPath || printerPath === BROWSER_PRINT_VALUE) return false
  await printRawText(printerPath, renderReceiptText(payload))
  return true
}

export async function dispatchPrint(
  payload: SaleReceiptPayload,
  settings: ReceiptSettings,
): Promise<ReceiptDeliveryResult> {
  const printerPath = (settings.printerPath || payload.printerPath || '').trim()
  if (printerPath && printerPath !== BROWSER_PRINT_VALUE) {
    try {
      await printViaQz(payload, settings)
      return { channel: 'print', status: 'sent' }
    } catch (err) {
      console.warn('QZ Tray indisponível, usando a janela do Windows.', err)
    }
  }

  try {
    printViaBrowser(renderReceiptHtml(payload))
    return { channel: 'print', status: 'sent' }
  } catch (err) {
    return {
      channel: 'print',
      status: 'failed',
      message: err instanceof Error ? err.message : 'Falha ao imprimir.',
    }
  }
}

export async function reprintSaleReceipt(
  input: BuildReceiptInput,
): Promise<ReceiptDeliveryResult> {
  const payload = buildSaleReceipt({ ...input, copy: 'segunda_via' })
  return dispatchPrint(payload, input.settings)
}

export async function dispatchReceiptApi(
  payload: SaleReceiptPayload,
): Promise<ReceiptDeliveryResult> {
  const apiUrl = import.meta.env.VITE_RECEIPT_API_URL?.trim()
  if (!apiUrl) {
    enqueueReceiptDelivery(payload)
    return {
      channel: 'email',
      status: 'queued',
      message: 'Comprovante na fila até a API de envio estar configurada.',
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { channel: 'email', status: 'sent' }
  } catch (err) {
    enqueueReceiptDelivery(payload)
    return {
      channel: 'email',
      status: 'failed',
      message: err instanceof Error ? err.message : 'Falha ao enviar comprovante.',
    }
  }
}

export async function fulfillSaleReceipt(
  input: BuildReceiptInput,
): Promise<ReceiptDeliveryResult[]> {
  const payload = buildSaleReceipt(input)
  const results: ReceiptDeliveryResult[] = []

  if (input.settings.printOnSale) {
    results.push(await dispatchPrint(payload, input.settings))
  } else {
    results.push({ channel: 'print', status: 'skipped' })
  }

  if (input.settings.sendReceiptOnSale) {
    results.push(await dispatchReceiptApi(payload))
    void flushReceiptOutbox()
  } else {
    results.push({ channel: 'email', status: 'skipped' })
  }

  return results
}

export async function printSampleReceipt(input: {
  organizationName: string
  settings: ReceiptSettings
  logoDataUrl?: string
}) {
  const now = new Date().toISOString()
  const payload: SaleReceiptPayload = {
    schemaVersion: 1,
    saleId: 'sale_teste_balqo',
    organizationId: 'org_teste',
    organizationName: input.organizationName,
    soldByName: 'Teste',
    items: [
      {
        name: 'PRODUTO EXEMPLO',
        quantity: 1,
        unitPriceCents: 1000,
        totalCents: 1000,
      },
    ],
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    payments: [{ method: 'cash', label: 'Dinheiro', amountCents: 1000 }],
    changeCents: 0,
    createdAt: now,
    paperWidth: input.settings.paperWidth,
  }
  if (input.logoDataUrl) payload.logoDataUrl = input.logoDataUrl
  if (input.settings.printerPath) payload.printerPath = input.settings.printerPath
  return dispatchPrint(payload, input.settings)
}

export { resolveReceiptSettings }
