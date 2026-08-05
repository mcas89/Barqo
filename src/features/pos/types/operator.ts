import type { UserRole } from '../../../shared/constants'
import { USER_ROLES } from '../../../shared/constants'
import type { PermissionMap, PermissionOverrides } from '../../users/permissions'
import {
  PERMISSIONS,
  hasPermission,
  resolvePermissions,
} from '../../users/permissions'

export type PosOperatorKind = 'owner' | 'employee'

/** Operador disponível para desbloqueio do PDV. */
export interface PosOperator {
  id: string
  kind: PosOperatorKind
  displayName: string
  role: UserRole
  hasPin: boolean
  /** Só em memória após carregar do Firestore — nunca persistir em sessionStorage. */
  pinHash: string | null
  permissionOverrides?: PermissionOverrides
}

/** Sessão ativa no PDV (após PIN correto). */
export interface PosOperatorSession {
  id: string
  kind: PosOperatorKind
  displayName: string
  role: UserRole
  unlockedAt: string
  permissions: PermissionMap
}

export const POS_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.OWNER]: 'Proprietário',
  [USER_ROLES.MANAGER]: 'Gerente',
  [USER_ROLES.CASHIER]: 'Caixa',
  [USER_ROLES.ATTENDANT]: 'Atendente',
}

export function isPrivilegedPosRole(role: UserRole): boolean {
  return role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER
}

/** Back-office (menu completo): só dono/gerente — legado sem permissões finas. */
export function canAccessBackOffice(role: UserRole): boolean {
  return isPrivilegedPosRole(role)
}

/** Remover item / limpar carrinho sem pedir PIN de novo — legado. */
export function canRemoveCartItem(role: UserRole): boolean {
  return isPrivilegedPosRole(role)
}

export function buildOperatorSession(
  operator: PosOperator,
  planId?: import('../../billing').PlanId,
): PosOperatorSession {
  return {
    id: operator.id,
    kind: operator.kind,
    displayName: operator.displayName,
    role: operator.role,
    unlockedAt: new Date().toISOString(),
    permissions: resolvePermissions({
      role: operator.role,
      planId,
      overrides: operator.permissionOverrides,
    }),
  }
}

export function sessionCan(
  session: PosOperatorSession | null | undefined,
  key: import('../../users/permissions').PermissionKey,
): boolean {
  if (!session) return false
  return hasPermission(session.permissions, key)
}

export { PERMISSIONS }
