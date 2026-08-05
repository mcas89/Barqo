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
import type { Employee, EmployeeInput, EmployeeRole } from '../types'
import { EMPLOYEE_ROLES } from '../types'
import { hashPin, validatePinFormat } from './pin'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function employeesCollection(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'employees')
}

function mapEmployee(id: string, data: Record<string, unknown>): Employee {
  const role = (data.role as EmployeeRole) || EMPLOYEE_ROLES.CASHIER
  return {
    id,
    organizationId: data.organizationId as string,
    displayName: data.displayName as string,
    role,
    pinHash: data.pinHash as string,
    active: data.active !== false,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  }
}

export async function listEmployees(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<Employee[]> {
  const snap = await getDocs(
    query(employeesCollection(organizationId), orderBy('displayName')),
  )
  const employees = snap.docs.map((item) => mapEmployee(item.id, item.data()))
  if (options?.includeInactive) return employees
  return employees.filter((employee) => employee.active)
}

/** Assentos usados = dono (1) + funcionários ativos. */
export function countSeatsUsed(activeEmployeeCount: number): number {
  return 1 + activeEmployeeCount
}

export async function createEmployee(
  organizationId: OrganizationId,
  input: EmployeeInput,
): Promise<Employee> {
  const pin = input.pin?.trim() ?? ''
  const pinError = validatePinFormat(pin)
  if (pinError) throw new Error(pinError)

  const name = input.displayName.trim()
  if (!name) throw new Error('Informe o nome do funcionário.')

  const id = createId('emp')
  const now = nowIso()
  const pinHash = await hashPin(organizationId, pin)

  const employee: Employee = {
    id,
    organizationId,
    displayName: name,
    role: input.role,
    pinHash,
    active: true,
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(
    doc(requireDb(), 'organizations', organizationId, 'employees', id),
    omitUndefined({ ...employee }),
  )

  return employee
}

export async function updateEmployee(
  organizationId: OrganizationId,
  employeeId: string,
  input: Partial<EmployeeInput> & { active?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: nowIso(),
  }

  if (input.displayName !== undefined) {
    const name = input.displayName.trim()
    if (!name) throw new Error('Informe o nome do funcionário.')
    patch.displayName = name
  }

  if (input.role !== undefined) {
    patch.role = input.role
  }

  if (input.active !== undefined) {
    patch.active = input.active
  }

  if (input.pin !== undefined && input.pin.trim() !== '') {
    const pinError = validatePinFormat(input.pin)
    if (pinError) throw new Error(pinError)
    patch.pinHash = await hashPin(organizationId, input.pin)
  }

  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'employees', employeeId),
    omitUndefined(patch),
  )
}

export async function setEmployeeActive(
  organizationId: OrganizationId,
  employeeId: string,
  active: boolean,
): Promise<void> {
  await updateEmployee(organizationId, employeeId, { active })
}

export function filterEmployees(employees: Employee[], search: string): Employee[] {
  const q = search.trim().toLowerCase()
  if (!q) return employees
  return employees.filter((employee) => {
    return (
      employee.displayName.toLowerCase().includes(q) ||
      employee.role.toLowerCase().includes(q)
    )
  })
}
