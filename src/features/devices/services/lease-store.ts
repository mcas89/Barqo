import { nowIso } from '../../../shared/lib/dates'
import { localDb } from '../../../infra/offline/db'
import {
  CLOCK_ROLLBACK_TOLERANCE_MS,
  DEVICE_LEASE_MS,
  DEVICE_LIMITED_AFTER_MS,
  DEVICE_STATUS,
  SUBSCRIPTION_OFFLINE_MS,
  type DeviceAccessState,
  type DeviceLease,
  type DeviceStatus,
  type LocalSubscriptionLease,
} from '../types'

export async function saveDeviceLease(lease: DeviceLease): Promise<void> {
  await localDb.deviceLeases.put({
    organizationId: lease.organizationId,
    lease,
    updatedAt: nowIso(),
  })
}

export async function getDeviceLease(organizationId: string): Promise<DeviceLease | null> {
  const row = await localDb.deviceLeases.get(organizationId)
  return row?.lease ?? null
}

export async function saveSubscriptionLease(
  lease: LocalSubscriptionLease,
): Promise<void> {
  await localDb.subscriptionLeases.put({
    organizationId: lease.organizationId,
    lease,
    updatedAt: nowIso(),
  })
}

export async function getSubscriptionLease(
  organizationId: string,
): Promise<LocalSubscriptionLease | null> {
  const row = await localDb.subscriptionLeases.get(organizationId)
  return row?.lease ?? null
}

export function buildDeviceLease(input: {
  deviceId: string
  organizationId: string
  deviceStatus: DeviceStatus
  nowMs?: number
}): DeviceLease {
  const nowMs = input.nowMs ?? Date.now()
  const issuedAt = new Date(nowMs).toISOString()
  return {
    deviceId: input.deviceId,
    organizationId: input.organizationId,
    issuedAt,
    expiresAt: new Date(nowMs + DEVICE_LEASE_MS).toISOString(),
    limitedAfter: new Date(nowMs + DEVICE_LIMITED_AFTER_MS).toISOString(),
    deviceStatus: input.deviceStatus,
    lastTrustedLocalMs: nowMs,
    localNowAtValidationMs: nowMs,
  }
}

export function buildSubscriptionLease(input: {
  organizationId: string
  planId: string
  subscriptionStatus: string
  canOperateOnline: boolean
  nowMs?: number
}): LocalSubscriptionLease {
  const nowMs = input.nowMs ?? Date.now()
  return {
    organizationId: input.organizationId,
    planId: input.planId,
    subscriptionStatus: input.subscriptionStatus,
    canOperateOnline: input.canOperateOnline,
    validatedAt: new Date(nowMs).toISOString(),
    offlineAllowedUntil: new Date(nowMs + SUBSCRIPTION_OFFLINE_MS).toISOString(),
    lastTrustedLocalMs: nowMs,
    localNowAtValidationMs: nowMs,
  }
}

export function isClockTampered(
  lastTrustedLocalMs: number,
  nowMs = Date.now(),
): boolean {
  return nowMs + CLOCK_ROLLBACK_TOLERANCE_MS < lastTrustedLocalMs
}

/** Avança âncora de relógio só para frente (anti-rollback). */
export function advanceTrustedClock(lease: {
  lastTrustedLocalMs: number
}, nowMs = Date.now()): number {
  return Math.max(lease.lastTrustedLocalMs, nowMs)
}

export function evaluateDeviceAccess(
  lease: DeviceLease | null,
  nowMs = Date.now(),
): DeviceAccessState {
  if (!lease) return 'limited'

  if (lease.deviceStatus === DEVICE_STATUS.BLOCKED) return 'blocked'
  if (lease.deviceStatus === DEVICE_STATUS.REMOVED) return 'removed'

  if (isClockTampered(lease.lastTrustedLocalMs, nowMs)) return 'clock_invalid'

  const limitedAfter = Date.parse(lease.limitedAfter)
  const expiresAt = Date.parse(lease.expiresAt)

  if (!Number.isNaN(limitedAfter) && nowMs > limitedAfter) return 'limited'
  if (!Number.isNaN(expiresAt) && nowMs > expiresAt) return 'lease_expired'
  return 'valid'
}

export function evaluateSubscriptionOfflineOk(
  lease: LocalSubscriptionLease | null,
  nowMs = Date.now(),
): { ok: boolean; reason?: 'subscription_expired' | 'subscription_blocked' | 'device_clock_invalid' } {
  if (!lease) {
    // Sem lease local: só opera se estiver online (quem chama decide).
    return { ok: false, reason: 'subscription_expired' }
  }
  if (!lease.canOperateOnline) {
    return { ok: false, reason: 'subscription_blocked' }
  }
  if (isClockTampered(lease.lastTrustedLocalMs, nowMs)) {
    return { ok: false, reason: 'device_clock_invalid' }
  }
  const until = Date.parse(lease.offlineAllowedUntil)
  if (Number.isNaN(until) || nowMs > until) {
    return { ok: false, reason: 'subscription_expired' }
  }
  return { ok: true }
}

export function hoursUntil(iso: string, nowMs = Date.now()): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, (t - nowMs) / 3_600_000)
}
