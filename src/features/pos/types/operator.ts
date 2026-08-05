import type { UserRole } from '../../../shared/constants'
import { USER_ROLES } from '../../../shared/constants'

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
}

/** Sessão ativa no PDV (após PIN correto). */
export interface PosOperatorSession {
  id: string
  kind: PosOperatorKind
  displayName: string
  role: UserRole
  unlockedAt: string
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

/** Back-office (menu completo): só dono/gerente. */
export function canAccessBackOffice(role: UserRole): boolean {
  return isPrivilegedPosRole(role)
}

/** Remover item / limpar carrinho sem pedir PIN de novo. */
export function canRemoveCartItem(role: UserRole): boolean {
  return isPrivilegedPosRole(role)
}
