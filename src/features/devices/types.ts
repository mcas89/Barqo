export const DEVICE_STATUS = {
  AUTHORIZED: 'authorized',
  BLOCKED: 'blocked',
  REMOVED: 'removed',
} as const

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS]

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  authorized: 'Autorizado',
  blocked: 'Bloqueado',
  removed: 'Removido',
}

export type DeviceAccessState =
  | 'valid'
  | 'lease_expired'
  | 'limited'
  | 'blocked'
  | 'removed'
  | 'clock_invalid'

export interface OrgDevice {
  id: string
  label: string
  status: DeviceStatus
  createdAt: string
  lastSeenAt: string
  authorizedAt?: string
  authorizedByUserId?: string
  blockedAt?: string
  blockedByUserId?: string
  /** Quando status mudou (bloqueio/remoção/reautorização). */
  statusChangedAt?: string
  platform?: string
  browser?: string
  operatorId?: string | null
  operatorName?: string | null
  /** Nome ou caminho UNC da impressora neste aparelho. */
  printerPath?: string | null
}

export interface OperatorPresence {
  operatorId: string
  deviceId: string
  displayName: string
  role: string
  unlockedAt: string
  lastSeenAt: string
}

/** Presença de operador no aparelho (slot “ao vivo”). */
export const DEVICE_STALE_MS = 2 * 60 * 1000
export const DEVICE_PRESENCE_HEARTBEAT_MS = 25_000
/** Renovação do lease de autorização (24h). */
export const DEVICE_LEASE_HEARTBEAT_MS = 15 * 60 * 1000

/** Compat: heartbeat antigo = presença. */
export const DEVICE_HEARTBEAT_MS = DEVICE_PRESENCE_HEARTBEAT_MS

export const DEVICE_LEASE_MS = 24 * 60 * 60 * 1000
export const DEVICE_LIMITED_AFTER_MS = 72 * 60 * 60 * 1000
export const SUBSCRIPTION_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000
/** Relógio local não pode voltar mais que isto sem validação online. */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000

export interface DeviceLease {
  deviceId: string
  organizationId: string
  issuedAt: string
  expiresAt: string
  limitedAfter: string
  deviceStatus: DeviceStatus
  /** Último horário local confiável (ms) observado após validação. */
  lastTrustedLocalMs: number
  /** Horário local no momento da validação online. */
  localNowAtValidationMs: number
}

export interface LocalSubscriptionLease {
  organizationId: string
  planId: string
  subscriptionStatus: string
  canOperateOnline: boolean
  validatedAt: string
  offlineAllowedUntil: string
  lastTrustedLocalMs: number
  localNowAtValidationMs: number
}

export type OperationDenyReason =
  | 'device_not_registered'
  | 'device_blocked'
  | 'device_removed'
  | 'device_validation_expired'
  | 'device_clock_invalid'
  | 'subscription_expired'
  | 'subscription_blocked'
  | 'operator_required'
  | 'cash_session_required'

export interface OperationAccess {
  allowed: boolean
  reason?: OperationDenyReason
  message?: string
  deviceState: DeviceAccessState
  subscriptionOk: boolean
  /** Aviso não bloqueante (ex.: lease perto de expirar). */
  warning?: string | null
}
