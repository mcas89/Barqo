import { createId } from '../../shared/lib/ids'
import { nowIso } from '../../shared/lib/dates'
import type { ReceiptOutboxItem, SaleReceiptPayload } from './types'

const OUTBOX_KEY = 'balqo.receipt-outbox'
const MAX_ITEMS = 80

function readQueue(): ReceiptOutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ReceiptOutboxItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items: ReceiptOutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-MAX_ITEMS)))
  } catch {
    // storage cheio / privado
  }
}

export function enqueueReceiptDelivery(payload: SaleReceiptPayload): ReceiptOutboxItem {
  const item: ReceiptOutboxItem = {
    id: createId('rcpt'),
    createdAt: nowIso(),
    attempts: 0,
    payload,
  }
  writeQueue([...readQueue(), item])
  return item
}

export function listQueuedReceipts(): ReceiptOutboxItem[] {
  return readQueue()
}

export async function flushReceiptOutbox(): Promise<{ sent: number; failed: number }> {
  const apiUrl = import.meta.env.VITE_RECEIPT_API_URL?.trim()
  if (!apiUrl) return { sent: 0, failed: 0 }

  const pending = readQueue()
  if (pending.length === 0) return { sent: 0, failed: 0 }

  const remaining: ReceiptOutboxItem[] = []
  let sent = 0
  let failed = 0

  for (const item of pending) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      sent += 1
    } catch {
      failed += 1
      remaining.push({ ...item, attempts: item.attempts + 1 })
    }
  }

  writeQueue(remaining)
  return { sent, failed }
}
