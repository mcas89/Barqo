export interface OrgDevice {
  id: string
  label: string
  createdAt: string
  lastSeenAt: string
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

export const DEVICE_STALE_MS = 2 * 60 * 1000
export const DEVICE_HEARTBEAT_MS = 25_000
