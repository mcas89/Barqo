import {
  collection,
  doc,
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
import type { Supplier, SupplierInput } from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function suppliersCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'suppliers')
}

function mapSupplier(id: string, data: Record<string, unknown>): Supplier {
  return {
    id,
    organizationId: data.organizationId as string,
    name: data.name as string,
    contactName: (data.contactName as string | undefined) || undefined,
    phone: (data.phone as string | undefined) || undefined,
    document: (data.document as string | undefined) || undefined,
    category: (data.category as string | undefined) || undefined,
    note: (data.note as string | undefined) || undefined,
    active: data.active !== false,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  }
}

export async function listSuppliers(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<Supplier[]> {
  const snap = await getDocs(
    query(suppliersCollection(organizationId), orderBy('name')),
  )
  const suppliers = snap.docs.map((item) => mapSupplier(item.id, item.data()))
  if (options?.includeInactive) return suppliers
  return suppliers.filter((supplier) => supplier.active)
}

export async function createSupplier(
  organizationId: OrganizationId,
  input: SupplierInput,
): Promise<Supplier> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome do fornecedor.')

  const id = createId('sup')
  const now = nowIso()
  const supplier: Supplier = {
    id,
    organizationId,
    name,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  }

  const contactName = input.contactName?.trim()
  const phone = input.phone?.trim()
  const document = input.document?.trim()
  const category = input.category?.trim()
  const note = input.note?.trim()
  if (contactName) supplier.contactName = contactName
  if (phone) supplier.phone = phone
  if (document) supplier.document = document
  if (category) supplier.category = category
  if (note) supplier.note = note

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'suppliers', id),
    omitUndefined({ ...supplier }),
  )

  return supplier
}

export async function updateSupplier(
  organizationId: OrganizationId,
  supplierId: string,
  input: SupplierInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome do fornecedor.')

  const patch: Record<string, unknown> = {
    name,
    updatedAt: nowIso(),
    contactName: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    document: input.document?.trim() || null,
    category: input.category?.trim() || null,
    note: input.note?.trim() || null,
  }

  if (input.active !== undefined) patch.active = input.active

  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'suppliers', supplierId),
    patch,
  )
}

export async function setSupplierActive(
  organizationId: OrganizationId,
  supplierId: string,
  active: boolean,
): Promise<void> {
  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'suppliers', supplierId),
    { active, updatedAt: nowIso() },
  )
}

export function filterSuppliers(suppliers: Supplier[], search: string): Supplier[] {
  const q = search.trim().toLowerCase()
  if (!q) return suppliers
  return suppliers.filter((supplier) => {
    const haystack = [
      supplier.name,
      supplier.contactName,
      supplier.phone,
      supplier.document,
      supplier.category,
      supplier.note,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
