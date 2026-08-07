import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId } from '../../../shared/types'
import { normalizeProductText } from '../types'
import type { ProductCategory, ProductCategoryInput } from '../types/category'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function categoriesCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'categories')
}

function productsCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'products')
}

function mapCategory(id: string, data: Record<string, unknown>): ProductCategory {
  return {
    id,
    organizationId: data.organizationId as OrganizationId,
    name: String(data.name ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

export async function listCategories(
  organizationId: OrganizationId,
): Promise<ProductCategory[]> {
  const snap = await getDocs(
    query(categoriesCollection(organizationId), orderBy('name', 'asc')),
  )
  return snap.docs
    .map((item) => mapCategory(item.id, item.data()))
    .filter((item) => Boolean(item.name))
}

export async function createCategory(
  organizationId: OrganizationId,
  input: ProductCategoryInput,
): Promise<ProductCategory> {
  const name = normalizeProductText(input.name)
  if (!name) throw new Error('Informe o nome da categoria.')

  const existing = await listCategories(organizationId)
  const conflict = existing.find((item) => item.name === name)
  if (conflict) return conflict

  const id = createId('cat')
  const createdAt = nowIso()
  const category: ProductCategory = {
    id,
    organizationId,
    name,
    createdAt,
    updatedAt: createdAt,
  }

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'categories', id),
    omitUndefined({ ...category }),
  )
  return category
}

export async function updateCategory(
  organizationId: OrganizationId,
  categoryId: string,
  input: ProductCategoryInput,
): Promise<ProductCategory> {
  const name = normalizeProductText(input.name)
  if (!name) throw new Error('Informe o nome da categoria.')

  const existing = await listCategories(organizationId)
  const current = existing.find((item) => item.id === categoryId)
  if (!current) throw new Error('Categoria não encontrada.')

  const conflict = existing.find((item) => item.id !== categoryId && item.name === name)
  if (conflict) throw new Error('Já existe uma categoria com esse nome.')

  const updatedAt = nowIso()
  const updated: ProductCategory = { ...current, name, updatedAt }

  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'categories', categoryId),
    { name, updatedAt },
  )

  if (current.name !== name) {
    await renameCategoryOnProducts(organizationId, current.name, name)
  }

  return updated
}

export async function deleteCategory(
  organizationId: OrganizationId,
  categoryId: string,
): Promise<void> {
  const existing = await listCategories(organizationId)
  const current = existing.find((item) => item.id === categoryId)
  if (!current) return

  await clearCategoryOnProducts(organizationId, current.name)
  await deleteDoc(
    doc(requireDb(), 'organizations', organizationId, 'categories', categoryId),
  )
}

async function renameCategoryOnProducts(
  organizationId: OrganizationId,
  fromName: string,
  toName: string,
) {
  const snap = await getDocs(
    query(productsCollection(organizationId), where('category', '==', fromName)),
  )
  if (snap.empty) return

  const db = requireDb()
  let batch = writeBatch(db)
  let count = 0
  const updatedAt = nowIso()

  for (const item of snap.docs) {
    batch.update(item.ref, { category: toName, updatedAt })
    count += 1
    if (count >= 400) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }
  if (count > 0) await batch.commit()
}

async function clearCategoryOnProducts(
  organizationId: OrganizationId,
  categoryName: string,
) {
  const snap = await getDocs(
    query(productsCollection(organizationId), where('category', '==', categoryName)),
  )
  if (snap.empty) return

  const db = requireDb()
  let batch = writeBatch(db)
  let count = 0
  const updatedAt = nowIso()

  for (const item of snap.docs) {
    batch.update(item.ref, { category: null, updatedAt })
    count += 1
    if (count >= 400) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }
  if (count > 0) await batch.commit()
}
