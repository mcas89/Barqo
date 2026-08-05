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
import { describeThisDevice, getLocalDeviceId, parseDevicePlatform } from '../lib/device-id'
import {
  DEVICE_STATUS,
  DEVICE_STALE_MS,
  type DeviceStatus,
  type OperatorPresence,
  type OrgDevice,
} from '../types'
import { buildDeviceLease, saveDeviceLease } from './lease-store'

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

export class DeviceBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeviceBlockedError'
  }
}

export class DeviceRemovedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeviceRemovedError'
  }
}

export function isTimestampStale(value: string | undefined, now = Date.now()): boolean {
  if (!value) return true
  const time = Date.parse(value)
  if (Number.isNaN(time)) return true
  return now - time > DEVICE_STALE_MS
}

function mapDevice(id: string, data: Record<string, unknown>): OrgDevice {
  const rawStatus = data.status as string | undefined
  const status: DeviceStatus =
    rawStatus === DEVICE_STATUS.BLOCKED ||
    rawStatus === DEVICE_STATUS.REMOVED ||
    rawStatus === DEVICE_STATUS.AUTHORIZED
      ? rawStatus
      : DEVICE_STATUS.AUTHORIZED

  const device: OrgDevice = {
    id,
    label: (data.label as string) || 'Aparelho',
    status,
    createdAt: (data.createdAt as string) || nowIso(),
    lastSeenAt: (data.lastSeenAt as string) || nowIso(),
  }
  if (data.authorizedAt) device.authorizedAt = data.authorizedAt as string
  if (data.authorizedByUserId) device.authorizedByUserId = data.authorizedByUserId as string
  if (data.blockedAt) device.blockedAt = data.blockedAt as string
  if (data.blockedByUserId) device.blockedByUserId = data.blockedByUserId as string
  if (data.platform) device.platform = data.platform as string
  if (data.browser) device.browser = data.browser as string
  if (data.operatorId) device.operatorId = data.operatorId as string
  if (data.operatorName) device.operatorName = data.operatorName as string
  if (typeof data.printerPath === 'string' && data.printerPath.trim()) {
    device.printerPath = data.printerPath.trim()
  }
  return device
}

function countsTowardSlot(device: OrgDevice): boolean {
  return device.status !== DEVICE_STATUS.REMOVED
}

export async function updateThisDevicePrinterPath(
  organizationId: string,
  printerPath: string,
): Promise<void> {
  const deviceId = getLocalDeviceId()
  const trimmed = printerPath.trim()
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'devices', deviceId), {
    printerPath: trimmed || null,
    lastSeenAt: nowIso(),
  })
}

export async function listOrgDevices(organizationId: string): Promise<OrgDevice[]> {
  const snap = await getDocs(collection(requireDb(), 'organizations', organizationId, 'devices'))
  return snap.docs
    .map((item) => mapDevice(item.id, item.data()))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
}

async function persistLocalLease(
  organizationId: string,
  deviceId: string,
  status: DeviceStatus,
): Promise<void> {
  await saveDeviceLease(
    buildDeviceLease({
      deviceId,
      organizationId,
      deviceStatus: status,
    }),
  )
}

export async function claimDeviceSlot(input: {
  organizationId: string
  planId: PlanId
  maxDevices: number
  userId?: string
}): Promise<OrgDevice> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const col = collection(db, 'organizations', input.organizationId, 'devices')
  const snap = await getDocs(col)
  const all = snap.docs.map((item) => mapDevice(item.id, item.data()))
  const active = all.filter(countsTowardSlot)
  const existing = all.find((device) => device.id === deviceId)
  const stamp = nowIso()
  const { platform, browser } = parseDevicePlatform()
  const defaultLabel = describeThisDevice()

  if (existing) {
    if (existing.status === DEVICE_STATUS.BLOCKED) {
      await persistLocalLease(input.organizationId, deviceId, DEVICE_STATUS.BLOCKED)
      throw new DeviceBlockedError(
        'Este dispositivo foi bloqueado pelo administrador. Você pode consultar e sincronizar, mas não realizar novas vendas.',
      )
    }
    if (existing.status === DEVICE_STATUS.REMOVED) {
      await persistLocalLease(input.organizationId, deviceId, DEVICE_STATUS.REMOVED)
      throw new DeviceRemovedError(
        'Este dispositivo não está mais autorizado. As operações pendentes foram preservadas.',
      )
    }

    await updateDoc(doc(db, 'organizations', input.organizationId, 'devices', deviceId), {
      lastSeenAt: stamp,
      platform,
      browser,
      status: DEVICE_STATUS.AUTHORIZED,
    })
    await persistLocalLease(input.organizationId, deviceId, DEVICE_STATUS.AUTHORIZED)
    return {
      ...existing,
      lastSeenAt: stamp,
      platform,
      browser,
      status: DEVICE_STATUS.AUTHORIZED,
    }
  }

  if (active.length >= input.maxDevices) {
    throw new DeviceLimitError(upgradeMessageForLimit('devices', input.planId))
  }

  const device: OrgDevice = {
    id: deviceId,
    label: defaultLabel,
    status: DEVICE_STATUS.AUTHORIZED,
    createdAt: stamp,
    lastSeenAt: stamp,
    authorizedAt: stamp,
    authorizedByUserId: input.userId,
    platform,
    browser,
  }

  await setDoc(
    doc(db, 'organizations', input.organizationId, 'devices', deviceId),
    omitUndefined({ ...device }),
  )
  await persistLocalLease(input.organizationId, deviceId, DEVICE_STATUS.AUTHORIZED)
  return device
}

/** Renova lease + lastSeen. Retorna status remoto do dispositivo. */
export async function renewDeviceLease(organizationId: string): Promise<OrgDevice> {
  const deviceId = getLocalDeviceId()
  const db = requireDb()
  const ref = doc(db, 'organizations', organizationId, 'devices', deviceId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new DeviceRemovedError('Este dispositivo não está mais autorizado.')
  }
  const device = mapDevice(snap.id, snap.data())
  if (device.status === DEVICE_STATUS.BLOCKED) {
    await persistLocalLease(organizationId, deviceId, DEVICE_STATUS.BLOCKED)
    throw new DeviceBlockedError('Este dispositivo foi bloqueado pelo administrador.')
  }
  if (device.status === DEVICE_STATUS.REMOVED) {
    await persistLocalLease(organizationId, deviceId, DEVICE_STATUS.REMOVED)
    throw new DeviceRemovedError('Este dispositivo não está mais autorizado.')
  }

  const stamp = nowIso()
  await updateDoc(ref, { lastSeenAt: stamp })
  await persistLocalLease(organizationId, deviceId, DEVICE_STATUS.AUTHORIZED)
  return { ...device, lastSeenAt: stamp }
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

export async function renameOrgDevice(
  organizationId: string,
  deviceId: string,
  label: string,
): Promise<void> {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Informe um nome para o aparelho.')
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'devices', deviceId), {
    label: trimmed,
  })
}

export async function blockOrgDevice(
  organizationId: string,
  deviceId: string,
  userId: string,
): Promise<void> {
  const stamp = nowIso()
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'devices', deviceId), {
    status: DEVICE_STATUS.BLOCKED,
    blockedAt: stamp,
    blockedByUserId: userId,
    operatorId: null,
    operatorName: null,
  })
  const sessions = await getDocs(
    collection(requireDb(), 'organizations', organizationId, 'operator_sessions'),
  )
  await Promise.all(
    sessions.docs.map(async (item) => {
      const data = item.data() as OperatorPresence
      if (data.deviceId === deviceId) await deleteDoc(item.ref).catch(() => undefined)
    }),
  )
}

export async function authorizeOrgDevice(
  organizationId: string,
  deviceId: string,
  userId: string,
): Promise<void> {
  const stamp = nowIso()
  await updateDoc(doc(requireDb(), 'organizations', organizationId, 'devices', deviceId), {
    status: DEVICE_STATUS.AUTHORIZED,
    authorizedAt: stamp,
    authorizedByUserId: userId,
    blockedAt: null,
    blockedByUserId: null,
  })
}

/** Soft-remove: libera slot sem apagar histórico; nunca apaga fila local. */
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
  await updateDoc(doc(db, 'organizations', organizationId, 'devices', deviceId), {
    status: DEVICE_STATUS.REMOVED,
    operatorId: null,
    operatorName: null,
    lastSeenAt: nowIso(),
  })
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
  // Soft-remove este aparelho (não apaga fila IndexedDB)
  await updateDoc(doc(db, 'organizations', organizationId, 'devices', deviceId), {
    status: DEVICE_STATUS.REMOVED,
    operatorId: null,
    operatorName: null,
  }).catch(() => undefined)
}
