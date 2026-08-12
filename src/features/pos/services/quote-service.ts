import { doc, setDoc } from 'firebase/firestore'
import { requireDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { CartItem } from '../types'

export type QuoteStatus = 'open' | 'converted' | 'canceled'

export interface QuoteItem {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  unit?: string
  loose?: boolean
}

export interface Quote {
  id: string
  organizationId: string
  items: QuoteItem[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  status: QuoteStatus
  createdAt: string
  createdByUserId: string
  createdByName: string
  operatorId: string
  deviceId: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  note?: string
}

export function cartToQuoteItems(cart: CartItem[]): QuoteItem[] {
  return cart.map((item) => ({
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalCents: Math.round(item.unitPriceCents * item.quantity),
    unit: item.unit,
    loose: item.loose,
  }))
}

export async function createQuote(input: {
  organizationId: string
  cart: CartItem[]
  discountCents: number
  subtotalCents: number
  totalCents: number
  userId: string
  userName: string
  operatorId: string
  deviceId: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  note?: string
}): Promise<Quote> {
  if (input.cart.length === 0) throw new Error('Inclua itens para gerar o orçamento.')

  const id = createId('quote')
  const createdAt = new Date().toISOString()
  const quote: Quote = omitUndefined({
    id,
    organizationId: input.organizationId,
    items: cartToQuoteItems(input.cart),
    subtotalCents: input.subtotalCents,
    discountCents: Math.max(0, input.discountCents),
    totalCents: input.totalCents,
    status: 'open' as const,
    createdAt,
    createdByUserId: input.userId,
    createdByName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    note: input.note,
  }) as Quote

  try {
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'quotes', id),
      quote,
    )
  } catch (err) {
    // Offline / rules: ainda devolve o orçamento para imprimir localmente.
    console.warn('Orçamento não sincronizado com a nuvem:', err)
  }

  return quote
}
