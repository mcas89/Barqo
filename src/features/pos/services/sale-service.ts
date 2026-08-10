import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import { getProduct, PRODUCT_TYPES } from '../../products'
import {
  assertDoseProductReady,
  applyBottleConsume,
  applyBottleRestore,
  doseConsumeMl,
  formatBottleStockLabel,
  readBottleStock,
  totalAvailableMl,
  usesBottleStockModel,
} from '../../products/services/dose-service'
import {
  assertReceivableCancellableForSale,
  cancelReceivableLinkedToSale,
  createReceivable,
  findReceivableBySaleId,
} from '../../receivables/services/receivable-service'
import { recordSaleCanceled } from '../../audit'
import {
  adjustCachedBottleConsume,
  adjustCachedBottleRestore,
  adjustCachedStock,
  enqueueOperation,
  getCachedProduct,
  isOnline,
  saveLocalSale,
  type SaleCreateQueuePayload,
} from '../../../infra/offline'
import type { CartItem, CompleteSaleInput, Sale, SaleItem } from '../types'
import { PAYMENT_METHODS } from '../types'

type StockDelta = {
  productId: string
  productName: string
  /** Baixa simples (produto normal). */
  quantity: number
  /** Baixa de dose em garrafa (ml efetivos). */
  consumeMl?: number
}

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function mergeStockDelta(
  map: Map<string, StockDelta>,
  productId: string,
  productName: string,
  quantity: number,
  consumeMl?: number,
) {
  const prev = map.get(productId)
  if (prev) {
    prev.quantity += quantity
    if (consumeMl != null) prev.consumeMl = (prev.consumeMl ?? 0) + consumeMl
    return
  }
  map.set(productId, {
    productId,
    productName,
    quantity,
    consumeMl,
  })
}

async function resolveSaleStockDeltas(
  organizationId: string,
  items: CartItem[],
  mode: 'online' | 'offline',
): Promise<StockDelta[]> {
  const map = new Map<string, StockDelta>()

  for (const item of items) {
    if (item.loose) continue

    if (item.type === PRODUCT_TYPES.PRODUCT) {
      mergeStockDelta(map, item.productId, item.name, item.quantity)
      continue
    }

    if (item.type !== PRODUCT_TYPES.DOSE) continue

    const dose =
      mode === 'online'
        ? await getProduct(organizationId, item.productId)
        : await getCachedProduct(organizationId, item.productId)
    if (!dose) {
      throw new Error(
        mode === 'offline'
          ? `Dose indisponível offline: ${item.name}. Sincronize o catálogo.`
          : `Dose indisponível: ${item.name}`,
      )
    }
    const base =
      dose.doseBaseProductId
        ? mode === 'online'
          ? await getProduct(organizationId, dose.doseBaseProductId)
          : await getCachedProduct(organizationId, dose.doseBaseProductId)
        : null
    assertDoseProductReady(dose, base)
    const consumeMl = doseConsumeMl({
      doseMl: dose.doseMl!,
      yieldPercent: dose.doseYieldPercent,
      quantity: item.quantity,
    })
    if (usesBottleStockModel(base!)) {
      const available = totalAvailableMl(readBottleStock(base!))
      if (available + 1e-6 < consumeMl) {
        throw new Error(
          `Estoque insuficiente na garrafa “${base!.name}” (${formatBottleStockLabel(base!)}).`,
        )
      }
      mergeStockDelta(map, base!.id, base!.name, 0, consumeMl)
    } else {
      // Legado: estoque em ML/L sem contentMl
      const units =
        base!.unit === 'L' ? consumeMl / 1000 : consumeMl
      if (base!.stock + 1e-9 < units) {
        throw new Error(
          `Estoque insuficiente na garrafa “${base!.name}” para a dose “${item.name}”.`,
        )
      }
      mergeStockDelta(map, base!.id, base!.name, units)
    }
  }

  return [...map.values()]
}

async function validateProductStock(
  organizationId: string,
  deltas: StockDelta[],
  mode: 'online' | 'offline',
) {
  for (const delta of deltas) {
    const product =
      mode === 'online'
        ? await getProduct(organizationId, delta.productId)
        : await getCachedProduct(organizationId, delta.productId)
    if (!product || !product.active) {
      throw new Error(
        mode === 'offline'
          ? `Produto indisponível offline: ${delta.productName}. Sincronize o catálogo online.`
          : `Produto indisponível: ${delta.productName}`,
      )
    }
    if (delta.consumeMl != null && delta.consumeMl > 0) {
      const available = totalAvailableMl(readBottleStock(product))
      if (available + 1e-6 < delta.consumeMl) {
        throw new Error(
          `Estoque insuficiente para ${delta.productName} (${formatBottleStockLabel(product)}).`,
        )
      }
      continue
    }
    if (product.stock + 1e-9 < delta.quantity) {
      throw new Error(
        `Estoque insuficiente para ${delta.productName} (disp.: ${product.stock}).`,
      )
    }
  }
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
  if (input.customerPhone) sale.customerPhone = input.customerPhone
  const note = input.note?.trim()
  if (note) sale.note = note

  return { sale, saleItems, onAccountCents }
}

async function validateStockOnline(input: CompleteSaleInput) {
  const deltas = await resolveSaleStockDeltas(input.organizationId, input.items, 'online')
  await validateProductStock(input.organizationId, deltas, 'online')
}

async function validateStockOffline(input: CompleteSaleInput) {
  const deltas = await resolveSaleStockDeltas(input.organizationId, input.items, 'offline')
  await validateProductStock(input.organizationId, deltas, 'offline')
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

  const deltas = await resolveSaleStockDeltas(input.organizationId, input.items, 'online')
  for (const delta of deltas) {
    const productRef = doc(
      db,
      'organizations',
      input.organizationId,
      'products',
      delta.productId,
    )
    const product = await getProduct(input.organizationId, delta.productId)
    if (!product) continue

    const movementId = createId('mov')
    if (delta.consumeMl != null && delta.consumeMl > 0) {
      const next = applyBottleConsume(product, delta.consumeMl)
      batch.update(
        productRef,
        omitUndefined({
          stock: next.stock,
          openBottleMlRemaining: next.openBottleMlRemaining,
          updatedAt: createdAt,
        }),
      )
      batch.set(doc(db, 'organizations', input.organizationId, 'stock_movements', movementId), {
        id: movementId,
        organizationId: input.organizationId,
        productId: delta.productId,
        productName: delta.productName,
        type: 'sale',
        quantity: -delta.consumeMl,
        unit: 'ML',
        stockBefore: product.stock,
        stockAfter: next.stock,
        openMlBefore: product.openBottleMlRemaining ?? 0,
        openMlAfter: next.openBottleMlRemaining,
        saleId: sale.id,
        createdAt,
        createdByUserId: input.soldByUserId,
        createdByName: input.soldByName,
        operatorId: input.operatorId,
        deviceId: input.deviceId,
        note: `Dose · −${Math.round(delta.consumeMl)} ml`,
      })
      continue
    }

    const nextStock = Math.max(0, product.stock - delta.quantity)
    batch.update(productRef, {
      stock: nextStock,
      updatedAt: createdAt,
    })
    batch.set(doc(db, 'organizations', input.organizationId, 'stock_movements', movementId), {
      id: movementId,
      organizationId: input.organizationId,
      productId: delta.productId,
      productName: delta.productName,
      type: 'sale',
      quantity: -delta.quantity,
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
  const stockDeltas = await resolveSaleStockDeltas(
    input.organizationId,
    input.items,
    'offline',
  )

  for (const delta of stockDeltas) {
    if (delta.consumeMl != null && delta.consumeMl > 0) {
      await adjustCachedBottleConsume(
        input.organizationId,
        delta.productId,
        delta.consumeMl,
      )
    } else {
      await adjustCachedStock(input.organizationId, delta.productId, -delta.quantity)
    }
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

    const product = await getProduct(organizationId, delta.productId)
    if (!product) continue
    const productRef = doc(db, 'organizations', organizationId, 'products', delta.productId)
    const updatedAt = nowIso()

    if (delta.consumeMl != null && delta.consumeMl > 0) {
      const next = applyBottleConsume(product, delta.consumeMl)
      await updateDoc(
        productRef,
        omitUndefined({
          stock: next.stock,
          openBottleMlRemaining: next.openBottleMlRemaining,
          updatedAt,
        }),
      )
      await setDoc(movementRef, {
        id: movementId,
        organizationId,
        productId: delta.productId,
        productName: delta.productName,
        type: 'sale',
        quantity: -delta.consumeMl,
        unit: 'ML',
        stockBefore: product.stock,
        stockAfter: next.stock,
        openMlBefore: product.openBottleMlRemaining ?? 0,
        openMlAfter: next.openBottleMlRemaining,
        saleId: sale.id,
        createdAt: sale.createdAt,
        createdByUserId: sale.soldByUserId,
        createdByName: sale.soldByName,
        operatorId: sale.operatorId,
        deviceId: sale.deviceId,
        offlineSync: true,
        note: `Dose · −${Math.round(delta.consumeMl)} ml`,
      })
      continue
    }

    const nextStock = Math.max(0, product.stock - delta.quantity)
    await updateDoc(productRef, {
      stock: nextStock,
      updatedAt,
    })
    await setDoc(movementRef, {
      id: movementId,
      organizationId,
      productId: delta.productId,
      productName: delta.productName,
      type: 'sale',
      quantity: -delta.quantity,
      stockBefore: product.stock,
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
    const deltas = await resolveSaleStockDeltas(input.organizationId, input.items, 'online')
    for (const delta of deltas) {
      if (delta.consumeMl != null && delta.consumeMl > 0) {
        await adjustCachedBottleConsume(
          input.organizationId,
          delta.productId,
          delta.consumeMl,
        ).catch(() => undefined)
      } else {
        await adjustCachedStock(input.organizationId, delta.productId, -delta.quantity).catch(
          () => undefined,
        )
      }
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

export async function getSale(
  organizationId: string,
  saleId: string,
): Promise<Sale | null> {
  const snap = await getDoc(
    doc(requireDb(), 'organizations', organizationId, 'sales', saleId),
  )
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Sale
}

/** Lista vendas do período (inclui canceladas) para gestão/devolução. */
export async function listSalesForManagement(
  organizationId: string,
  fromIso: string,
  toIso?: string,
): Promise<Sale[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'sales')
  const snap = await getDocs(
    query(col, where('createdAt', '>=', fromIso), orderBy('createdAt', 'asc')),
  )

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Sale)
    .filter((sale) => {
      if (toIso && sale.createdAt > toIso) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function cancelSale(input: {
  organizationId: string
  saleId: string
  userId: string
  userName: string
  operatorId: string
  deviceId: string
  reason: string
}): Promise<Sale> {
  if (!isOnline()) {
    throw new Error('Cancele a venda com internet. Offline ainda não é suportado.')
  }
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const reason = input.reason.trim()
  if (reason.length < 3) {
    throw new Error('Informe o motivo do cancelamento (mín. 3 caracteres).')
  }

  const sale = await getSale(input.organizationId, input.saleId)
  if (!sale) throw new Error('Venda não encontrada.')
  if (sale.status === 'canceled') return sale
  if (sale.status && sale.status !== 'completed') {
    throw new Error('Esta venda não pode ser cancelada.')
  }

  const linkedReceivable = await findReceivableBySaleId(input.organizationId, sale.id)
  assertReceivableCancellableForSale(linkedReceivable)

  const canceledAt = nowIso()
  const db = requireDb()
  const batch = writeBatch(db)

  const canceledSale: Sale = {
    ...sale,
    status: 'canceled',
    canceledAt,
    canceledByUserId: input.userId,
    canceledByName: input.userName,
    canceledByOperatorId: input.operatorId,
    cancelReason: reason,
  }

  batch.set(
    doc(db, 'organizations', input.organizationId, 'sales', sale.id),
    omitUndefined({ ...canceledSale }),
  )

  const stockRestores = await resolveSaleStockDeltas(
    input.organizationId,
    (sale.items ?? []).map((item) => ({
      productId: item.productId,
      name: item.name,
      unitPriceCents: item.unitPriceCents,
      costCents: item.costCents,
      quantity: item.quantity,
      type: item.type,
    })),
    'online',
  )

  for (const restore of stockRestores) {
    const product = await getProduct(input.organizationId, restore.productId)
    if (!product || product.type !== PRODUCT_TYPES.PRODUCT) continue

    const movementId = `mov_cancel_${sale.id}_${restore.productId}`

    if (restore.consumeMl != null && restore.consumeMl > 0) {
      const next = applyBottleRestore(product, restore.consumeMl)
      batch.update(
        doc(db, 'organizations', input.organizationId, 'products', restore.productId),
        omitUndefined({
          stock: next.stock,
          openBottleMlRemaining: next.openBottleMlRemaining,
          updatedAt: canceledAt,
        }),
      )
      batch.set(
        doc(db, 'organizations', input.organizationId, 'stock_movements', movementId),
        omitUndefined({
          id: movementId,
          organizationId: input.organizationId,
          productId: restore.productId,
          productName: restore.productName,
          type: 'sale_return',
          quantity: restore.consumeMl,
          unit: 'ML',
          stockBefore: product.stock,
          stockAfter: next.stock,
          openMlBefore: product.openBottleMlRemaining ?? 0,
          openMlAfter: next.openBottleMlRemaining,
          saleId: sale.id,
          createdAt: canceledAt,
          createdByUserId: input.userId,
          createdByName: input.userName,
          operatorId: input.operatorId,
          deviceId: input.deviceId,
          note: `Cancelamento: ${reason}`,
        }),
      )
      continue
    }

    const stockBefore = product.stock
    const stockAfter = stockBefore + restore.quantity

    batch.update(
      doc(db, 'organizations', input.organizationId, 'products', restore.productId),
      {
        stock: stockAfter,
        updatedAt: canceledAt,
      },
    )

    batch.set(
      doc(db, 'organizations', input.organizationId, 'stock_movements', movementId),
      omitUndefined({
        id: movementId,
        organizationId: input.organizationId,
        productId: restore.productId,
        productName: restore.productName,
        type: 'sale_return',
        quantity: restore.quantity,
        stockBefore,
        stockAfter,
        saleId: sale.id,
        createdAt: canceledAt,
        createdByUserId: input.userId,
        createdByName: input.userName,
        operatorId: input.operatorId,
        deviceId: input.deviceId,
        note: `Cancelamento: ${reason}`,
      }),
    )
  }

  await batch.commit()

  await cancelReceivableLinkedToSale({
    organizationId: input.organizationId,
    saleId: sale.id,
  })

  for (const restore of stockRestores) {
    if (restore.consumeMl != null && restore.consumeMl > 0) {
      await adjustCachedBottleRestore(
        input.organizationId,
        restore.productId,
        restore.consumeMl,
      ).catch(() => undefined)
    } else {
      await adjustCachedStock(
        input.organizationId,
        restore.productId,
        restore.quantity,
      ).catch(() => undefined)
    }
  }

  await saveLocalSale(canceledSale, true).catch(() => undefined)

  await recordSaleCanceled({
    organizationId: input.organizationId,
    saleId: sale.id,
    totalCents: sale.totalCents,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    reason,
  })

  return canceledSale
}