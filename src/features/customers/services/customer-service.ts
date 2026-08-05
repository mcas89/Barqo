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
import type { Customer, CustomerInput } from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function customersCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'customers')
}

function mapCustomer(id: string, data: Record<string, unknown>): Customer {
  return {
    id,
    organizationId: data.organizationId as string,
    name: data.name as string,
    phone: (data.phone as string | undefined) || undefined,
    document: (data.document as string | undefined) || undefined,
    note: (data.note as string | undefined) || undefined,
    active: data.active !== false,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  }
}

export async function listCustomers(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<Customer[]> {
  const snap = await getDocs(
    query(customersCollection(organizationId), orderBy('name')),
  )
  const customers = snap.docs.map((item) => mapCustomer(item.id, item.data()))
  if (options?.includeInactive) return customers
  return customers.filter((customer) => customer.active)
}

export async function createCustomer(
  organizationId: OrganizationId,
  input: CustomerInput,
): Promise<Customer> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome do cliente.')

  const id = createId('cus')
  const now = nowIso()
  const customer: Customer = {
    id,
    organizationId,
    name,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  }

  const phone = input.phone?.trim()
  const document = input.document?.trim()
  const note = input.note?.trim()
  if (phone) customer.phone = phone
  if (document) customer.document = document
  if (note) customer.note = note

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'customers', id),
    omitUndefined({ ...customer }),
  )

  return customer
}

export async function updateCustomer(
  organizationId: OrganizationId,
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome do cliente.')

  const patch: Record<string, unknown> = {
    name,
    updatedAt: nowIso(),
  }

  if (input.active !== undefined) patch.active = input.active

  const phone = input.phone?.trim()
  const document = input.document?.trim()
  const note = input.note?.trim()
  patch.phone = phone || null
  patch.document = document || null
  patch.note = note || null

  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'customers', customerId),
    patch,
  )
}

export async function setCustomerActive(
  organizationId: OrganizationId,
  customerId: string,
  active: boolean,
): Promise<void> {
  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'customers', customerId),
    { active, updatedAt: nowIso() },
  )
}

export function filterCustomers(customers: Customer[], search: string): Customer[] {
  const q = search.trim().toLowerCase()
  if (!q) return customers
  return customers.filter((customer) => {
    const haystack = [customer.name, customer.phone, customer.document, customer.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
