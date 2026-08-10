import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId, UserId } from '../../../shared/types'
import { getProduct, listProducts, type Product } from '../../products'
import {
  formatProductStockLabel,
  readBottleStock,
  usesBottleStockModel,
} from '../../products/services/dose-service'
import {
  STOCK_MOVEMENT_TYPES,
  type StockAdjustmentInput,
  type StockEntryInput,
  type StockLossInput,
  type StockMovement,
  type StockMovementType,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function mapMovement(id: string, data: Record<string, unknown>): StockMovement {
  return {
    id,
    organizationId: data.organizationId as string,
    productId: data.productId as string,
    productName: data.productName as string,
    type: (data.type as StockMovementType) || STOCK_MOVEMENT_TYPES.ADJUSTMENT,
    quantity: Number(data.quantity ?? 0),
    stockBefore: Number(data.stockBefore ?? 0),
    stockAfter: Number(data.stockAfter ?? 0),
    createdAt: data.createdAt as string,
    createdByUserId: data.createdByUserId as string | undefined,
    createdByName: data.createdByName as string | undefined,
    operatorId: data.operatorId as string | undefined,
    deviceId: data.deviceId as string | undefined,
    note: data.note as string | undefined,
    saleId: data.saleId as string | undefined,
  }
}

export async function listInventoryCatalog(
  organizationId: OrganizationId,
): Promise<Product[]> {
  return listProducts(organizationId, { includeInactive: false })
}

export async function listInventoryProducts(
  organizationId: OrganizationId,
): Promise<Product[]> {
  const products = await listInventoryCatalog(organizationId)
  return products.filter((product) => product.type === 'product')
}

export async function listStockMovements(
  organizationId: OrganizationId,
  options?: { productId?: string; max?: number },
): Promise<StockMovement[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'stock_movements')
  const max = options?.max ?? 80

  let snap
  if (options?.productId) {
    // Sem orderBy composto; ordena no cliente
    snap = await getDocs(
      query(col, where('productId', '==', options.productId), limit(max)),
    )
  } else {
    snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(max)))
  }

  return snap.docs
    .map((item) => mapMovement(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function applyStockChange(input: {
  organizationId: OrganizationId
  productId: string
  delta: number
  type: StockMovementType
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  note?: string
  absoluteStock?: number
}): Promise<StockMovement> {
  if (!input.operatorId?.trim()) {
    throw new Error('Operador não identificado.')
  }
  if (!input.deviceId?.trim()) {
    throw new Error('Dispositivo não identificado.')
  }

  const product = await getProduct(input.organizationId, input.productId)
  if (!product || product.type !== 'product') {
    throw new Error('Produto de estoque não encontrado.')
  }
  if (!product.active) {
    throw new Error('Produto inativo.')
  }

  const stockBefore = product.stock
  const stockAfter =
    input.absoluteStock != null
      ? Math.max(0, Math.round(input.absoluteStock))
      : Math.max(0, stockBefore + input.delta)

  const quantity =
    input.absoluteStock != null ? stockAfter - stockBefore : input.delta

  if (quantity === 0 && input.type !== STOCK_MOVEMENT_TYPES.ADJUSTMENT) {
    throw new Error('Informe uma quantidade diferente de zero.')
  }

  const now = nowIso()
  const movementId = createId('mov')
  const movement: StockMovement = {
    id: movementId,
    organizationId: input.organizationId,
    productId: product.id,
    productName: product.name,
    type: input.type,
    quantity,
    stockBefore,
    stockAfter,
    createdAt: now,
    createdByUserId: input.userId,
    createdByName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
  }

  const note = input.note?.trim()
  if (note) movement.note = note

  const db = requireDb()
  const batch = writeBatch(db)
  batch.update(doc(db, 'organizations', input.organizationId, 'products', product.id), {
    stock: stockAfter,
    updatedAt: now,
  })
  batch.set(
    doc(db, 'organizations', input.organizationId, 'stock_movements', movementId),
    omitUndefined({ ...movement }),
  )
  await batch.commit()

  return movement
}

export async function registerStockEntry(input: {
  organizationId: OrganizationId
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  data: StockEntryInput
}): Promise<StockMovement> {
  const qty = Math.round(input.data.quantity)
  if (qty <= 0) throw new Error('Quantidade de entrada deve ser maior que zero.')

  return applyStockChange({
    organizationId: input.organizationId,
    productId: input.data.productId,
    delta: qty,
    type: STOCK_MOVEMENT_TYPES.ENTRY,
    userId: input.userId,
    userName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    note: input.data.note,
  })
}

export async function registerStockLoss(input: {
  organizationId: OrganizationId
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  data: StockLossInput
}): Promise<StockMovement> {
  const qty = Math.round(input.data.quantity)
  if (qty <= 0) throw new Error('Quantidade de perda deve ser maior que zero.')

  const product = await getProduct(input.organizationId, input.data.productId)
  if (!product) throw new Error('Produto não encontrado.')
  if (qty > product.stock) {
    throw new Error(
      `Estoque insuficiente (disponível: ${formatProductStockLabel(product)}).`,
    )
  }

  return applyStockChange({
    organizationId: input.organizationId,
    productId: input.data.productId,
    delta: -qty,
    type: STOCK_MOVEMENT_TYPES.LOSS,
    userId: input.userId,
    userName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    note: input.data.note,
  })
}

export async function registerStockAdjustment(input: {
  organizationId: OrganizationId
  userId: UserId
  userName: string
  operatorId: string
  deviceId: string
  data: StockAdjustmentInput
}): Promise<StockMovement> {
  const newStock = Math.round(input.data.newStock)
  if (newStock < 0) throw new Error('Saldo não pode ser negativo.')

  return applyStockChange({
    organizationId: input.organizationId,
    productId: input.data.productId,
    delta: 0,
    absoluteStock: newStock,
    type: STOCK_MOVEMENT_TYPES.ADJUSTMENT,
    userId: input.userId,
    userName: input.userName,
    operatorId: input.operatorId,
    deviceId: input.deviceId,
    note: input.data.note || 'Inventário / contagem',
  })
}

export function isLowStock(product: Product): boolean {
  if (product.type !== 'product' || product.minStock <= 0) return false
  const sealed = usesBottleStockModel(product)
    ? readBottleStock(product).sealed
    : product.stock
  return sealed <= product.minStock
}

export function filterInventoryProducts(
  products: Product[],
  search: string,
  onlyLowStock: boolean,
): Product[] {
  let list = products
  if (onlyLowStock) list = list.filter(isLowStock)

  const term = search.trim().toLowerCase()
  if (!term) return list

  return list.filter((product) => {
    const haystack = [product.name, product.barcode, product.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
}
