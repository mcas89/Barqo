import { collection, doc, setDoc } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { getLocalDeviceId } from '../../devices/lib/device-id'
import { isOnline } from '../../../infra/offline'

export const PIN_MAX_FAILURES = 5
export const PIN_LOCK_MS = 5 * 60 * 1000

export interface PinLockState {
  failures: number
  lockedUntil: string | null
  updatedAt: string
}

function lockKey(organizationId: string, operatorId: string) {
  return `balqo.pin.lock.${organizationId}.${operatorId}`
}

export function readPinLockState(
  organizationId: string,
  operatorId: string,
): PinLockState {
  try {
    const raw = localStorage.getItem(lockKey(organizationId, operatorId))
    if (!raw) {
      return { failures: 0, lockedUntil: null, updatedAt: nowIso() }
    }
    const data = JSON.parse(raw) as PinLockState
    return {
      failures: Number(data.failures ?? 0),
      lockedUntil: data.lockedUntil ?? null,
      updatedAt: data.updatedAt ?? nowIso(),
    }
  } catch {
    return { failures: 0, lockedUntil: null, updatedAt: nowIso() }
  }
}

function writePinLockState(
  organizationId: string,
  operatorId: string,
  state: PinLockState,
): void {
  try {
    localStorage.setItem(lockKey(organizationId, operatorId), JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

export function getPinLockRemainingMs(
  organizationId: string,
  operatorId: string,
  nowMs = Date.now(),
): number {
  const state = readPinLockState(organizationId, operatorId)
  if (!state.lockedUntil) return 0
  const until = Date.parse(state.lockedUntil)
  if (Number.isNaN(until)) return 0
  return Math.max(0, until - nowMs)
}

export function assertPinNotLocked(organizationId: string, operatorId: string): void {
  const remaining = getPinLockRemainingMs(organizationId, operatorId)
  if (remaining <= 0) return
  const minutes = Math.max(1, Math.ceil(remaining / 60_000))
  const seconds = Math.ceil(remaining / 1000)
  const label =
    seconds >= 60 ? `${minutes} min` : `${seconds}s`
  throw new Error(
    `PIN bloqueado após várias tentativas. Aguarde ${label} ou peça ao dono/gerente para redefinir.`,
  )
}

export async function recordPinFailure(input: {
  organizationId: string
  operatorId: string
  operatorName?: string
}): Promise<{ locked: boolean; failures: number; lockedUntil: string | null }> {
  assertPinNotLocked(input.organizationId, input.operatorId)

  const state = readPinLockState(input.organizationId, input.operatorId)
  const failures = state.failures + 1
  const locked = failures >= PIN_MAX_FAILURES
  const lockedUntil = locked ? new Date(Date.now() + PIN_LOCK_MS).toISOString() : null
  const next: PinLockState = {
    failures: locked ? 0 : failures,
    lockedUntil,
    updatedAt: nowIso(),
  }
  writePinLockState(input.organizationId, input.operatorId, next)

  await logPinAttempt({
    organizationId: input.organizationId,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    success: false,
    locked,
    failures: locked ? PIN_MAX_FAILURES : failures,
  }).catch(() => undefined)

  return { locked, failures: locked ? PIN_MAX_FAILURES : failures, lockedUntil }
}

export async function clearPinFailures(input: {
  organizationId: string
  operatorId: string
  operatorName?: string
}): Promise<void> {
  writePinLockState(input.organizationId, input.operatorId, {
    failures: 0,
    lockedUntil: null,
    updatedAt: nowIso(),
  })
  await logPinAttempt({
    organizationId: input.organizationId,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    success: true,
    locked: false,
    failures: 0,
  }).catch(() => undefined)
}

/** Dono/gerente zera o bloqueio local (ex.: após redefinir PIN). */
export function resetPinLock(organizationId: string, operatorId: string): void {
  writePinLockState(organizationId, operatorId, {
    failures: 0,
    lockedUntil: null,
    updatedAt: nowIso(),
  })
}

async function logPinAttempt(input: {
  organizationId: string
  operatorId: string
  operatorName?: string
  success: boolean
  locked: boolean
  failures: number
}): Promise<void> {
  if (!isOnline()) return
  const db = getFirestoreDb()
  if (!db) return

  const id = createId('pintry')
  await setDoc(doc(collection(db, 'organizations', input.organizationId, 'pin_attempts'), id), {
    id,
    organizationId: input.organizationId,
    operatorId: input.operatorId,
    operatorName: input.operatorName ?? null,
    deviceId: getLocalDeviceId(),
    success: input.success,
    locked: input.locked,
    failures: input.failures,
    createdAt: nowIso(),
  })
}
