import { USER_ROLES, type UserRole } from '../../shared/constants'
import type { OrganizationId } from '../../shared/types'
import type { PermissionOverrides } from './permissions'

/** Papéis de funcionário (dono fica no Auth, não nesta coleção). */
export const EMPLOYEE_ROLES = {
  MANAGER: USER_ROLES.MANAGER,
  CASHIER: USER_ROLES.CASHIER,
  ATTENDANT: USER_ROLES.ATTENDANT,
} as const

export type EmployeeRole =
  (typeof EMPLOYEE_ROLES)[keyof typeof EMPLOYEE_ROLES]

export interface Employee {
  id: string
  organizationId: OrganizationId
  displayName: string
  role: EmployeeRole
  /** Hash do PIN — nunca expor o PIN em claro. */
  pinHash: string
  active: boolean
  /** Só no plano Gestão — sobrescreve o padrão do papel. */
  permissions?: PermissionOverrides
  createdAt: string
  updatedAt: string
}

export interface EmployeeInput {
  displayName: string
  role: EmployeeRole
  /** PIN numérico 4–6 dígitos; obrigatório na criação; opcional na edição. */
  pin?: string
  permissions?: PermissionOverrides
}

export function isEmployeeRole(role: UserRole): role is EmployeeRole {
  return (
    role === EMPLOYEE_ROLES.MANAGER ||
    role === EMPLOYEE_ROLES.CASHIER ||
    role === EMPLOYEE_ROLES.ATTENDANT
  )
}

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  [EMPLOYEE_ROLES.MANAGER]: 'Gerente',
  [EMPLOYEE_ROLES.CASHIER]: 'Caixa',
  [EMPLOYEE_ROLES.ATTENDANT]: 'Atendente',
}
