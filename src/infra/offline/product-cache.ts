import type { Product } from '../../features/products/types'
import { localDb, type CachedProduct } from './db'

function toCached(product: Product): CachedProduct {
  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    barcode: product.barcode,
    category: product.category,
    unit: product.unit,
    type: product.type,
    priceCents: product.priceCents,
    costCents: product.costCents,
    stock: product.stock,
    minStock: product.minStock,
    active: product.active,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

export function cachedToProduct(cached: CachedProduct): Product {
  return {
    id: cached.id,
    organizationId: cached.organizationId,
    name: cached.name,
    barcode: cached.barcode,
    category: cached.category,
    unit: cached.unit || 'UN',
    type: cached.type || 'product',
    priceCents: cached.priceCents,
    costCents: cached.costCents ?? 0,
    stock: cached.stock ?? 0,
    minStock: cached.minStock ?? 0,
    active: cached.active !== false,
    createdAt: cached.createdAt,
    updatedAt: cached.updatedAt,
  }
}

export async function cacheProducts(
  organizationId: string,
  products: Product[],
): Promise<void> {
  const rows = products
    .filter((product) => product.organizationId === organizationId)
    .map(toCached)
  await localDb.transaction('rw', localDb.products, async () => {
    await localDb.products.where('organizationId').equals(organizationId).delete()
    if (rows.length > 0) await localDb.products.bulkPut(rows)
  })
}

export async function listCachedProducts(organizationId: string): Promise<Product[]> {
  const rows = await localDb.products.where('organizationId').equals(organizationId).toArray()
  return rows
    .filter((row) => row.active !== false)
    .map(cachedToProduct)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}

export async function getCachedProduct(
  organizationId: string,
  productId: string,
): Promise<Product | null> {
  const row = await localDb.products.get(productId)
  if (!row || row.organizationId !== organizationId) return null
  return cachedToProduct(row)
}

export async function adjustCachedStock(
  organizationId: string,
  productId: string,
  delta: number,
): Promise<void> {
  const row = await localDb.products.get(productId)
  if (!row || row.organizationId !== organizationId) return
  await localDb.products.update(productId, {
    stock: Math.max(0, (row.stock ?? 0) + delta),
    updatedAt: new Date().toISOString(),
  })
}
