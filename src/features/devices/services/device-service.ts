import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import { upgradeMessageForLimit, type PlanId } from '../../billing'
import { describeThisDevice, getLocalDeviceId } from '../lib/device-id'
import {
  DEVICE_STALE_MS,
  type OperatorPresence,
  type OrgDevice,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

export class DeviceLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeviceLimitError'
  }
}

export class OperatorInUseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperatorInUseError'
  }
}

export function isTimestampStale(value: string | undefined, now = Date.now()): boolean {
  if (!value) return true
  const time = Date.parse(value)
  if (Number.isNaN(time)) return true
  return now - time > DEVICE_STALE_MS
}

function mapDevice(id: string, data: Record<string, unknown>): OrgDevice {
  const device: OrgDevice = {
    id,
    label: (data.label as string) || 'Aparelho',
    createdAt: (data.createdAt as string) || nowIso(),
    lastSeenAt: (data.lastSeenAt as string) || nowIso(),
  }
  if (data.operatorId) device.operatorId = data.operatorId as string
  if (data.operatorName) device.operatorName = data.operatorName as string
  return device
}

export async function listOrgDevices(organizationId: string): Promise<OrgDevice[]> {
  const snap = await getDocs(collection(requireDb(), 'organizations', organizationId, 'devices'))
  return snap.docs
    .map((item) => mapDevice(item.id, item.data()))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
}

export async function claimDeviceSlot(input: {
  organizationId: string
  planId: PlanId
  maxDevices: number
}): Promise<OrgDevice> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const col = collection(db, 'organizations', input.organizationId, 'devices')
  const snap = await getDocs(col)
  const now = Date.now()
  const live: OrgDevice[] = []

  await Promise.all(
    snap.docs.map(async (item) => {
      const device = mapDevice(item.id, item.data())
      if (item.id !== deviceId && isTimestampStale(device.lastSeenAt, now)) {
        await deleteDoc(item.ref).catch(() => undefined)
        return
      }
      live.push(device)
    }),
  )

  const existing = live.find((device) => device.id === deviceId)
  const stamp = nowIso()
  const label = describeThisDevice()

  if (existing) {
    await updateDoc(doc(db, 'organizations', input.organizationId, 'devices', deviceId), {
      label,
      lastSeenAt: stamp,
    })
    return { ...existing, label, lastSeenAt: stamp }
  }

  if (live.length >= input.maxDevices) {
    throw new DeviceLimitError(upgradeMessageForLimit('devices', input.planId))
  }

  const device: OrgDevice = {
    id: deviceId,
    label,
    createdAt: stamp,
    lastSeenAt: stamp,
  }

  await setDoc(
    doc(db, 'organizations', input.organizationId, 'devices', deviceId),
    omitUndefined({ ...device }),
  )
  return device
}

export async function heartbeatDevice(
  organizationId: string,
  operatorId?: string | null,
): Promise<void> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const stamp = nowIso()
  await updateDoc(doc(db, 'organizations', organizationId, 'devices', deviceId), {
    lastSeenAt: stamp,
  }).catch(() => undefined)

  if (!operatorId) return
  await updateDoc(
    doc(db, 'organizations', organizationId, 'operator_sessions', operatorId),
    { lastSeenAt: stamp },
  ).catch(() => undefined)
}

export async function claimOperatorPresence(input: {
  organizationId: string
  operatorId: string
  displayName: string
  role: string
}): Promise<void> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const ref = doc(db, 'organizations', input.organizationId, 'operator_sessions', input.operatorId)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const current = snap.data() as OperatorPresence
    if (current.deviceId !== deviceId && !isTimestampStale(current.lastSeenAt)) {
      let deviceLabel = 'outro aparelho'
      try {
        const deviceSnap = await getDoc(
          doc(db, 'organizations', input.organizationId, 'devices', current.deviceId),
        )
        const label = deviceSnap.exists()
          ? ((deviceSnap.data() as OrgDevice).label || '').trim()
          : ''
        if (label) deviceLabel = label
      } catch {
        // usa o texto padrão
      }
      throw new OperatorInUseError(
        `${current.displayName} já está com este PIN em ${deviceLabel}. Peça para sair lá ou use outro usuário.`,
      )
    }
  }

  const stamp = nowIso()
  const presence: OperatorPresence = {
    operatorId: input.operatorId,
    deviceId,
    displayName: input.displayName,
    role: input.role,
    unlockedAt: snap.exists()
      ? ((snap.data() as OperatorPresence).unlockedAt ?? stamp)
      : stamp,
    lastSeenAt: stamp,
  }

  await setDoc(ref, omitUndefined({ ...presence }))
  await updateDoc(doc(db, 'organizations', input.organizationId, 'devices', deviceId), {
    lastSeenAt: stamp,
    operatorId: input.operatorId,
    operatorName: input.displayName,
  }).catch(() => undefined)
}

export async function listLiveOperatorPresences(
  organizationId: string,
): Promise<Array<OperatorPresence & { deviceLabel: string }>> {
  const db = requireDb()
  const [sessionsSnap, devicesSnap] = await Promise.all([
    getDocs(collection(db, 'organizations', organizationId, 'operator_sessions')),
    getDocs(collection(db, 'organizations', organizationId, 'devices')),
  ])
  const devices = new Map(
    devicesSnap.docs.map((item) => [item.id, mapDevice(item.id, item.data() as Record<string, unknown>)]),
  )
  const localId = getLocalDeviceId()

  return sessionsSnap.docs
    .map((item) => item.data() as OperatorPresence)
    .filter((presence) => !isTimestampStale(presence.lastSeenAt) && presence.deviceId !== localId)
    .map((presence) => ({
      ...presence,
      deviceLabel: devices.get(presence.deviceId)?.label?.trim() || 'outro aparelho',
    }))
}

export async function releaseOperatorPresence(
  organizationId: string,
  operatorId: string,
): Promise<void> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const ref = doc(db, 'organizations', organizationId, 'operator_sessions', operatorId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = snap.data() as OperatorPresence
  if (current.deviceId !== deviceId) return
  await deleteDoc(ref).catch(() => undefined)
  await updateDoc(doc(db, 'organizations', organizationId, 'devices', deviceId), {
    operatorId: null,
    operatorName: null,
    lastSeenAt: nowIso(),
  }).catch(() => undefined)
}

export async function releaseLocalDevice(organizationId: string): Promise<void> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const sessions = await getDocs(
    collection(db, 'organizations', organizationId, 'operator_sessions'),
  )
  await Promise.all(
    sessions.docs.map(async (item) => {
      const data = item.data() as OperatorPresence
      if (data.deviceId === deviceId) await deleteDoc(item.ref).catch(() => undefined)
    }),
  )
  await deleteDoc(doc(db, 'organizations', organizationId, 'devices', deviceId)).catch(
    () => undefined,
  )
}

export async function removeOrgDevice(
  organizationId: string,
  deviceId: string,
): Promise<void> {
  const db = requireDb()
  const sessions = await getDocs(
    collection(db, 'organizations', organizationId, 'operator_sessions'),
  )
  await Promise.all(
    sessions.docs.map(async (item) => {
      const data = item.data() as OperatorPresence
      if (data.deviceId === deviceId) await deleteDoc(item.ref).catch(() => undefined)
    }),
  )
  await deleteDoc(doc(db, 'organizations', organizationId, 'devices', deviceId))
}
