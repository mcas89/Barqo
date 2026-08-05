import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import { pickPersonName, resolvePersonName } from '../../../shared/lib/person-name'
import { healOwnerDisplayName } from '../../organizations/services/organization-service'
import { USER_ROLES } from '../../../shared/constants'
import type { OrganizationId, UserId } from '../../../shared/types'
import { listEmployees } from '../../users/services/employee-service'
import { hashPin, validatePinFormat, verifyPin } from '../../users/services/pin'
import type { PosOperator, PosOperatorSession } from '../types/operator'
import { buildOperatorSession } from '../types/operator'
import { defaultPermissionsForRole } from '../../users/permissions'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

function sessionKey(organizationId: string) {
  return `balqo.pos.operator.${organizationId}`
}

export function readOperatorSession(
  organizationId: string,
): PosOperatorSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(organizationId))
    if (!raw) return null
    const data = JSON.parse(raw) as PosOperatorSession
    if (!data?.id || !data?.role || !data?.displayName) return null
    if (!data.permissions) {
      data.permissions = defaultPermissionsForRole(data.role)
    }
    return data
  } catch {
    return null
  }
}

export function writeOperatorSession(
  organizationId: string,
  session: PosOperatorSession,
): void {
  sessionStorage.setItem(sessionKey(organizationId), JSON.stringify(session))
}

export function clearOperatorSession(organizationId: string): void {
  sessionStorage.removeItem(sessionKey(organizationId))
}

export function toOperatorSession(
  operator: PosOperator,
  planId?: import('../../billing').PlanId,
): PosOperatorSession {
  return buildOperatorSession(operator, planId)
}

export async function listPosOperators(input: {
  organizationId: OrganizationId
  owner: { id: UserId; displayName: string }
  ownerNameFallback?: string
}): Promise<PosOperator[]> {
  const db = requireDb()
  const memberSnap = await getDoc(
    doc(db, 'organizations', input.organizationId, 'members', input.owner.id),
  )
  const memberData = memberSnap.exists() ? memberSnap.data() : null
  const ownerPinHash = (memberData?.pinHash as string | undefined) || null
  const memberName = pickPersonName([
    memberData?.displayName as string | undefined,
    input.owner.displayName,
    input.ownerNameFallback,
  ])

  if (
    memberName !== 'Proprietário' &&
    memberName !== (memberData?.displayName as string | undefined)
  ) {
    void healOwnerDisplayName({
      organizationId: input.organizationId,
      ownerId: input.owner.id,
      displayName: memberName,
    })
  }

  const owner: PosOperator = {
    id: input.owner.id,
    kind: 'owner',
    displayName: memberName,
    role: USER_ROLES.OWNER,
    hasPin: Boolean(ownerPinHash),
    pinHash: ownerPinHash,
  }

  const employees = await listEmployees(input.organizationId)
  const employeeOps: PosOperator[] = employees
    .filter((employee) => employee.active)
    .map((employee) => ({
      id: employee.id,
      kind: 'employee' as const,
      displayName: resolvePersonName(employee.displayName, 'Funcionário'),
      role: employee.role,
      hasPin: Boolean(employee.pinHash),
      pinHash: employee.pinHash || null,
      permissionOverrides: employee.permissions,
    }))

  return [owner, ...employeeOps]
}

export async function setOwnerPosPin(
  organizationId: OrganizationId,
  ownerUserId: UserId,
  pin: string,
): Promise<void> {
  const pinError = validatePinFormat(pin)
  if (pinError) throw new Error(pinError)

  const pinHash = await hashPin(organizationId, pin)
  await updateDoc(
    doc(requireDb(), 'organizations', organizationId, 'members', ownerUserId),
    omitUndefined({
      pinHash,
      pinUpdatedAt: nowIso(),
    }),
  )
}

export async function unlockOperator(
  organizationId: string,
  operator: PosOperator,
  pin: string,
  planId?: import('../../billing').PlanId,
): Promise<PosOperatorSession> {
  if (!operator.pinHash) {
    throw new Error('Este operador ainda não tem PIN. Defina o PIN antes de entrar.')
  }

  const ok = await verifyPin(organizationId, pin, operator.pinHash)
  if (!ok) {
    throw new Error('PIN incorreto.')
  }

  return toOperatorSession(operator, planId)
}

/** Autoriza ação sensível com PIN de dono ou gerente. */
export async function authorizePrivilegedPin(
  organizationId: string,
  operators: PosOperator[],
  pin: string,
): Promise<PosOperator> {
  const privileged = operators.filter(
    (op) =>
      op.hasPin &&
      op.pinHash &&
      (op.role === USER_ROLES.OWNER || op.role === USER_ROLES.MANAGER),
  )

  if (privileged.length === 0) {
    throw new Error('Nenhum proprietário/gerente com PIN cadastrado.')
  }

  for (const op of privileged) {
    if (!op.pinHash) continue
    if (await verifyPin(organizationId, pin, op.pinHash)) {
      return op
    }
  }

  throw new Error('PIN de proprietário/gerente inválido.')
}
