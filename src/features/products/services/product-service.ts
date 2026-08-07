import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId } from '../../../shared/types'
import {
  canAddMore,
  upgradeMessageForLimit,
  type PlanId,
} from '../../billing/plans'
import {
  normalizeProductText,
  type Product,
  type ProductBarcodeMeta,
  type ProductInput,
} from '../types'
import {
  buildBarcodeMeta,
  findBarcodeConflict,
  generateBalqoInternalBarcode,
  productHasBarcode,
} from './barcode-service'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function productsCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'products')
}

function mapBarcodeMeta(data: Record<string, unknown>): ProductBarcodeMeta | undefined {
  const meta = data.barcodeMeta as ProductBarcodeMeta | undefined
  if (meta?.value) return meta
  const barcode = (data.barcode as string | undefined)?.trim()
  if (!barcode) return undefined
  return buildBarcodeMeta({ value: barcode })
}

function mapProduct(id: string, data: Record<string, unknown>): Product {
  const barcode = (data.barcode as string | undefined) || undefined
  const barcodeMeta = mapBarcodeMeta(data)
  const product: Product = {
    id,
    organizationId: data.organizationId as string,
    name: normalizeProductText(String(data.name ?? '')),
    unit: (data.unit as Product['unit']) || 'UN',
    type: (data.type as Product['type']) || 'product',
    priceCents: Number(data.priceCents ?? 0),
    costCents: Number(data.costCents ?? 0),
    stock: Number(data.stock ?? 0),
    minStock: Number(data.minStock ?? 0),
    active: data.active !== false,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  }
  if (barcode) product.barcode = barcode
  if (barcodeMeta) product.barcodeMeta = barcodeMeta
  if (data.category) product.category = normalizeProductText(String(data.category))
  return product
}

async function assertBarcodeUnique(
  organizationId: OrganizationId,
  barcode: string | undefined,
  excludeProductId?: string,
): Promise<void> {
  const trimmed = barcode?.trim()
  if (!trimmed) return
  const products = await listProducts(organizationId, { includeInactive: true })
  const conflict = findBarcodeConflict(products, trimmed, excludeProductId)
  if (conflict) {
    throw new Error(
      `Código já usado em “${conflict.name}”. Cada código deve ser único na loja.`,
    )
  }
}

function resolveBarcodeFields(input: ProductInput): {
  barcode?: string
  barcodeMeta?: ProductBarcodeMeta
} {
  const barcode = input.barcode?.trim()
  if (!barcode) return {}
  const barcodeMeta =
    input.barcodeMeta && input.barcodeMeta.value.trim() === barcode
      ? input.barcodeMeta
      : buildBarcodeMeta({
          value: barcode,
          type: input.barcodeMeta?.type,
          source: input.barcodeMeta?.source,
          generatedAt: input.barcodeMeta?.generatedAt,
          generatedByOperatorId: input.barcodeMeta?.generatedByOperatorId,
        })
  return { barcode, barcodeMeta }
}

export async function listProducts(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<Product[]> {
  const col = productsCollection(organizationId)
  const snap = await getDocs(query(col, orderBy('name')))
  const products = snap.docs.map((item) => mapProduct(item.id, item.data()))

  if (options?.includeInactive) return products
  return products.filter((product) => product.active)
}

export async function getProduct(
  organizationId: OrganizationId,
  productId: string,
): Promise<Product | null> {
  const snap = await getDoc(doc(requireDb(), 'organizations', organizationId, 'products', productId))
  if (!snap.exists()) return null
  return mapProduct(snap.id, snap.data())
}

export async function countActiveProducts(
  organizationId: OrganizationId,
): Promise<number> {
  const products = await listProducts(organizationId, { includeInactive: false })
  return products.length
}

async function assertProductSlotAvailable(
  organizationId: OrganizationId,
  planId: PlanId,
): Promise<void> {
  const activeCount = await countActiveProducts(organizationId)
  if (!canAddMore(planId, 'products', activeCount)) {
    throw new Error(upgradeMessageForLimit('products', planId))
  }
}

export async function createProduct(
  organizationId: OrganizationId,
  input: ProductInput,
  planId: PlanId,
): Promise<Product> {
  await assertProductSlotAvailable(organizationId, planId)
  await assertBarcodeUnique(organizationId, input.barcode)
  const id = createId('prod')
  const now = nowIso()
  const { barcode, barcodeMeta } = resolveBarcodeFields(input)
  const product: Product = {
    id,
    organizationId,
    name: normalizeProductText(input.name),
    unit: input.unit,
    type: input.type,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    costCents: Math.max(0, Math.round(input.costCents)),
    stock: input.type === 'service' ? 0 : Math.max(0, input.stock),
    minStock: input.type === 'service' ? 0 : Math.max(0, input.minStock),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  }

  const category = input.category ? normalizeProductText(input.category) : ''
  if (barcode) product.barcode = barcode
  if (barcodeMeta) product.barcodeMeta = barcodeMeta
  if (category) product.category = category

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'products', id),
    omitUndefined({ ...product }),
  )
  return product
}

export async function updateProduct(
  organizationId: OrganizationId,
  productId: string,
  input: ProductInput,
  planId?: PlanId,
): Promise<Product> {
  const existing = await getProduct(organizationId, productId)
  if (!existing) {
    throw new Error('Produto não encontrado.')
  }

  const nextActive = input.active ?? existing.active
  if (nextActive && !existing.active) {
    if (!planId) {
      throw new Error('Plano necessário para reativar produto.')
    }
    await assertProductSlotAvailable(organizationId, planId)
  }

  await assertBarcodeUnique(organizationId, input.barcode, productId)

  const { barcode, barcodeMeta } = resolveBarcodeFields(input)
  const updated: Product = {
    ...existing,
    name: normalizeProductText(input.name),
    unit: input.unit,
    type: input.type,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    costCents: Math.max(0, Math.round(input.costCents)),
    stock: input.type === 'service' ? 0 : Math.max(0, input.stock),
    minStock: input.type === 'service' ? 0 : Math.max(0, input.minStock),
    active: input.active ?? existing.active,
    updatedAt: nowIso(),
  }

  const category = input.category ? normalizeProductText(input.category) : ''
  if (barcode) {
    updated.barcode = barcode
    if (barcodeMeta) updated.barcodeMeta = barcodeMeta
  } else {
    delete updated.barcode
    delete updated.barcodeMeta
  }
  if (category) updated.category = category
  else delete updated.category

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'products', productId),
    omitUndefined({ ...updated }),
  )
  return updated
}

export async function setProductActive(
  organizationId: OrganizationId,
  productId: string,
  active: boolean,
  planId?: PlanId,
): Promise<void> {
  if (active) {
    if (!planId) {
      throw new Error('Plano necessário para reativar produto.')
    }
    const existing = await getProduct(organizationId, productId)
    if (existing && !existing.active) {
      await assertProductSlotAvailable(organizationId, planId)
    }
  }
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'products', productId), {
    active,
    updatedAt: nowIso(),
  })
}

/** Aplica código no produto sem alterar demais campos. */
export async function setProductBarcode(
  organizationId: OrganizationId,
  productId: string,
  meta: ProductBarcodeMeta,
): Promise<Product> {
  const existing = await getProduct(organizationId, productId)
  if (!existing) throw new Error('Produto não encontrado.')

  await assertBarcodeUnique(organizationId, meta.value, productId)

  const updated: Product = {
    ...existing,
    barcode: meta.value.trim(),
    barcodeMeta: meta,
    updatedAt: nowIso(),
  }

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'products', productId),
    omitUndefined({ ...updated }),
  )
  return updated
}

export async function generateInternalBarcodeForProduct(input: {
  organizationId: OrganizationId
  productId: string
  operatorId?: string
}): Promise<Product> {
  const existing = await getProduct(input.organizationId, input.productId)
  if (!existing) throw new Error('Produto não encontrado.')
  if (productHasBarcode(existing)) {
    throw new Error('Este produto já possui código de barras. Não substituímos códigos existentes.')
  }

  let value = generateBalqoInternalBarcode()
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await assertBarcodeUnique(input.organizationId, value, input.productId)
      break
    } catch {
      value = generateBalqoInternalBarcode()
    }
  }

  const meta = buildBarcodeMeta({
    value,
    type: 'code128_internal',
    source: 'balqo_generated',
    generatedAt: nowIso(),
    generatedByOperatorId: input.operatorId,
  })

  const product = await setProductBarcode(input.organizationId, input.productId, meta)
  return product
}

export async function generateMissingBarcodes(input: {
  organizationId: OrganizationId
  productIds: string[]
  operatorId?: string
}): Promise<{ generated: number; preserved: number; products: Product[] }> {
  let generated = 0
  let preserved = 0
  const products: Product[] = []

  for (const productId of input.productIds) {
    const existing = await getProduct(input.organizationId, productId)
    if (!existing) continue
    if (productHasBarcode(existing)) {
      preserved += 1
      products.push(existing)
      continue
    }
    const updated = await generateInternalBarcodeForProduct({
      organizationId: input.organizationId,
      productId,
      operatorId: input.operatorId,
    })
    generated += 1
    products.push(updated)
  }

  return { generated, preserved, products }
}

export function filterProducts(products: Product[], search: string): Product[] {
  const term = search.trim().toLowerCase()
  if (!term) return products

  return products.filter((product) => {
    const haystack = [product.name, product.barcode, product.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(term)
  })
}

export function findProductByBarcode(
  products: Product[],
  barcode: string,
): Product | null {
  const code = barcode.trim().toLowerCase()
  if (!code) return null
  return (
    products.find((product) => product.barcode?.trim().toLowerCase() === code) ?? null
  )
}
