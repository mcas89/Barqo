import { doc, writeBatch } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import { getProduct } from '../../products'
import { createReceivable } from '../../receivables/services/receivable-service'
import type { CartItem, CompleteSaleInput, Sale, SaleItem } from '../types'
import { PAYMENT_METHODS } from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
}

export function cartTotalCents(items: CartItem[], discountCents: number): number {
  return Math.max(0, cartSubtotalCents(items) - Math.max(0, discountCents))
}

export function paymentsTotalCents(
  payments: { amountCents: number }[],
): number {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0)
}

export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  if (input.items.length === 0) {
    throw new Error('Carrinho vazio.')
  }

  if (!input.cashSessionId) {
    throw new Error('Abra o caixa antes de vender.')
  }

  const discountCents = Math.max(0, Math.round(input.discountCents))
  const subtotalCents = cartSubtotalCents(input.items)
  const totalCents = cartTotalCents(input.items, discountCents)
  const paidCents = paymentsTotalCents(input.payments)

  if (totalCents <= 0) {
    throw new Error('Total da venda inválido.')
  }

  if (paidCents < totalCents) {
    throw new Error('Pagamento insuficiente para o total da venda.')
  }

  const onAccountCents = input.payments
    .filter((payment) => payment.method === PAYMENT_METHODS.ON_ACCOUNT)
    .reduce((sum, payment) => sum + Math.round(payment.amountCents), 0)

  if (onAccountCents > 0 && (!input.customerId || !input.customerName)) {
    throw new Error('Selecione o cliente para vender no fiado.')
  }

  const db = requireDb()
  const saleId = createId('sale')
  const createdAt = nowIso()
  const changeCents = Math.max(0, paidCents - totalCents)

  const saleItems: SaleItem[] = input.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    costCents: item.costCents,
    totalCents: item.unitPriceCents * item.quantity,
    type: item.type,
  }))

  // Valida estoque atual antes de gravar
  for (const item of input.items) {
    if (item.loose || item.type !== 'product') continue
    const product = await getProduct(input.organizationId, item.productId)
    if (!product || !product.active) {
      throw new Error(`Produto indisponível: ${item.name}`)
    }
    if (product.stock < item.quantity) {
      throw new Error(`Estoque insuficiente para ${item.name} (disp.: ${product.stock}).`)
    }
  }

  const sale: Sale = {
    id: saleId,
    organizationId: input.organizationId,
    items: saleItems,
    subtotalCents,
    discountCents,
    totalCents,
    payments: input.payments.map((payment) => ({
      method: payment.method,
      amountCents: Math.round(payment.amountCents),
    })),
    changeCents,
    status: 'completed',
    soldByUserId: input.soldByUserId,
    soldByName: input.soldByName,
    createdAt,
    cashSessionId: input.cashSessionId,
  }

  if (input.operatorId) sale.operatorId = input.operatorId
  if (input.operatorRole) sale.operatorRole = input.operatorRole
  if (input.customerId) sale.customerId = input.customerId
  if (input.customerName) sale.customerName = input.customerName

  const note = input.note?.trim()
  if (note) sale.note = note

  const batch = writeBatch(db)
  batch.set(
    doc(db, 'organizations', input.organizationId, 'sales', saleId),
    omitUndefined({ ...sale }),
  )

  for (const item of input.items) {
    if (item.loose || item.type !== 'product') continue

    const productRef = doc(
      db,
      'organizations',
      input.organizationId,
      'products',
      item.productId,
    )
    const product = await getProduct(input.organizationId, item.productId)
    if (!product) continue

    const nextStock = Math.max(0, product.stock - item.quantity)
    batch.update(productRef, {
      stock: nextStock,
      updatedAt: createdAt,
    })

    const movementId = createId('mov')
    batch.set(doc(db, 'organizations', input.organizationId, 'stock_movements', movementId), {
      id: movementId,
      organizationId: input.organizationId,
      productId: item.productId,
      productName: item.name,
      type: 'sale',
      quantity: -item.quantity,
      stockBefore: product.stock,
      stockAfter: nextStock,
      saleId,
      createdAt,
      createdByUserId: input.soldByUserId,
    })
  }

  await batch.commit()

  if (onAccountCents > 0 && input.customerId && input.customerName) {
    await createReceivable({
      organizationId: input.organizationId,
      userId: input.soldByUserId,
      userName: input.soldByName,
      data: {
        customerId: input.customerId,
        customerName: input.customerName,
        totalCents: onAccountCents,
        saleId,
        description: `Fiado da venda ${saleId}`,
      },
    })
  }

  return sale
}
