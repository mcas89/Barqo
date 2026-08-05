import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import { getProduct } from '../../products'
import { createReceivable } from '../../receivables/services/receivable-service'
import {
  adjustCachedStock,
  enqueueOperation,
  getCachedProduct,
  isOnline,
  saveLocalSale,
  type SaleCreateQueuePayload,
} from '../../../infra/offline'
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

function buildSaleDraft(input: CompleteSaleInput): {
  sale: Sale
  saleItems: SaleItem[]
  onAccountCents: number
} {
  if (input.items.length === 0) {
    throw new Error('Carrinho vazio.')
  }
  if (!input.cashSessionId) {
    throw new Error('Abra o caixa antes de vender.')
  }
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado. Desbloqueie o PDV com o PIN.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
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
    operatorId: input.operatorId,
    deviceId: input.deviceId,
  }

  if (input.operatorRole) sale.operatorRole = input.operatorRole
  if (input.customerId) sale.customerId = input.customerId
  if (input.customerName) sale.customerName = input.customerName
  const note = input.note?.trim()
  if (note) sale.note = note

  return { sale, saleItems, onAccountCents }
}

async function validateStockOnline(input: CompleteSaleInput) {
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
}

async function validateStockOffline(input: CompleteSaleInput) {
  for (const item of input.items) {
    if (item.loose || item.type !== 'product') continue
    const product = await getCachedProduct(input.organizationId, item.productId)
    if (!product || !product.active) {
      throw new Error(`Produto indisponível offline: ${item.name}. Sincronize o catálogo online.`)
    }
    if (product.stock < item.quantity) {
      throw new Error(`Estoque insuficiente para ${item.name} (disp.: ${product.stock}).`)
    }
  }
}

async function persistSaleOnline(
  input: CompleteSaleInput,
  sale: Sale,
  onAccountCents: number,
): Promise<void> {
  const db = requireDb()
  const createdAt = sale.createdAt
  const batch = writeBatch(db)
  batch.set(
    doc(db, 'organizations', input.organizationId, 'sales', sale.id),
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
      saleId: sale.id,
      createdAt,
      createdByUserId: input.soldByUserId,
      createdByName: input.soldByName,
      operatorId: input.operatorId,
      deviceId: input.deviceId,
    })
  }

  await batch.commit()

  if (onAccountCents > 0 && input.customerId && input.customerName) {
    await createReceivable({
      organizationId: input.organizationId,
      userId: input.soldByUserId,
      userName: input.soldByName,
      operatorId: input.operatorId,
      deviceId: input.deviceId,
      data: {
        customerId: input.customerId,
        customerName: input.customerName,
        totalCents: onAccountCents,
        saleId: sale.id,
        description: `Fiado da venda ${sale.id}`,
      },
    })
  }
}

async function persistSaleOffline(
  input: CompleteSaleInput,
  sale: Sale,
  onAccountCents: number,
): Promise<void> {
  const stockDeltas = input.items
    .filter((item) => !item.loose && item.type === 'product')
    .map((item) => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
    }))

  for (const delta of stockDeltas) {
    await adjustCachedStock(input.organizationId, delta.productId, -delta.quantity)
  }

  const payload: SaleCreateQueuePayload = {
    sale,
    stockDeltas,
    receivable:
      onAccountCents > 0 && input.customerId && input.customerName
        ? {
            customerId: input.customerId,
            customerName: input.customerName,
            totalCents: onAccountCents,
            description: `Fiado da venda ${sale.id}`,
          }
        : undefined,
  }

  await enqueueOperation(input.organizationId, 'sale.create', payload, {
    id: `sale_${sale.id}`,
  })
  await saveLocalSale(sale, false)
}

/** Aplica no Firestore uma venda que ficou na fila (idempotente por ids estáveis). */
export async function applyQueuedSaleCreate(
  organizationId: string,
  payload: SaleCreateQueuePayload,
): Promise<void> {
  const db = requireDb()
  const sale = payload.sale
  const saleRef = doc(db, 'organizations', organizationId, 'sales', sale.id)
  const existing = await getDoc(saleRef)
  if (!existing.exists()) {
    await setDoc(saleRef, omitUndefined({ ...sale }))
  }

  for (const delta of payload.stockDeltas) {
    const movementId = `mov_${sale.id}_${delta.productId}`
    const movementRef = doc(db, 'organizations', organizationId, 'stock_movements', movementId)
    const movementSnap = await getDoc(movementRef)
    if (movementSnap.exists()) continue

    const productRef = doc(db, 'organizations', organizationId, 'products', delta.productId)
    const productSnap = await getDoc(productRef)
    if (!productSnap.exists()) continue
    const stock = Number(productSnap.data().stock ?? 0)
    const nextStock = Math.max(0, stock - delta.quantity)
    await updateDoc(productRef, {
      stock: nextStock,
      updatedAt: nowIso(),
    })
    await setDoc(movementRef, {
      id: movementId,
      organizationId,
      productId: delta.productId,
      productName: delta.productName,
      type: 'sale',
      quantity: -delta.quantity,
      stockBefore: stock,
      stockAfter: nextStock,
      saleId: sale.id,
      createdAt: sale.createdAt,
      createdByUserId: sale.soldByUserId,
      createdByName: sale.soldByName,
      operatorId: sale.operatorId,
      deviceId: sale.deviceId,
      offlineSync: true,
    })
  }

  if (payload.receivable) {
    await createReceivable({
      organizationId,
      userId: sale.soldByUserId,
      userName: sale.soldByName,
      operatorId: sale.operatorId,
      deviceId: sale.deviceId,
      id: `rec_${sale.id}`,
      data: {
        customerId: payload.receivable.customerId,
        customerName: payload.receivable.customerName,
        totalCents: payload.receivable.totalCents,
        saleId: sale.id,
        description: payload.receivable.description,
      },
    })
  }
}

export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const { sale, onAccountCents } = buildSaleDraft(input)
  const offline = !isOnline()

  if (offline) {
    await validateStockOffline(input)
    await persistSaleOffline(input, sale, onAccountCents)
    return sale
  }

  try {
    await validateStockOnline(input)
    await persistSaleOnline(input, sale, onAccountCents)
    for (const item of input.items) {
      if (item.loose || item.type !== 'product') continue
      await adjustCachedStock(input.organizationId, item.productId, -item.quantity).catch(
        () => undefined,
      )
    }
    await saveLocalSale(sale, true).catch(() => undefined)
    return sale
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    const networkish =
      !isOnline() ||
      /unavailable|network|failed to fetch|offline|interno/i.test(message) ||
      (err as { code?: string })?.code === 'unavailable'

    if (!networkish) throw err

    await validateStockOffline(input).catch(async () => {
      // se não há cache, ainda tenta enfileirar com o estoque do carrinho
    })
    await persistSaleOffline(input, sale, onAccountCents)
    return sale
  }
}
