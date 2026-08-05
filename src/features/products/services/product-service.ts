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
import { normalizeProductText, type Product, type ProductInput } from '../types'

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

function mapProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    organizationId: data.organizationId as string,
    name: normalizeProductText(String(data.name ?? '')),
    barcode: (data.barcode as string | undefined) || undefined,
    category: data.category ? normalizeProductText(String(data.category)) : undefined,
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
}

export async function listProducts(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<Product[]> {
  const col = productsCollection(organizationId)
  // orderBy único evita índice composto; filtro active no cliente
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

export async function createProduct(
  organizationId: OrganizationId,
  input: ProductInput,
): Promise<Product> {
  const id = createId('prod')
  const now = nowIso()
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

  const barcode = input.barcode?.trim()
  const category = input.category ? normalizeProductText(input.category) : ''
  if (barcode) product.barcode = barcode
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
): Promise<Product> {
  const existing = await getProduct(organizationId, productId)
  if (!existing) {
    throw new Error('Produto não encontrado.')
  }

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

  const barcode = input.barcode?.trim()
  const category = input.category ? normalizeProductText(input.category) : ''
  if (barcode) updated.barcode = barcode
  else delete updated.barcode
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
): Promise<void> {
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'products', productId), {
    active,
    updatedAt: nowIso(),
  })
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
