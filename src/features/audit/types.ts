import type { OrganizationId } from '../../shared/types'

export const AUDIT_EVENT_TYPES = {
  OPERATOR_SWITCH: 'operator.switch',
} as const

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]

export interface OperatorSwitchAuditEvent {
  id: string
  organizationId: OrganizationId
  type: typeof AUDIT_EVENT_TYPES.OPERATOR_SWITCH
  previousOperatorId: string | null
  previousOperatorName: string | null
  newOperatorId: string
  newOperatorName: string
  deviceId: string
  cashSessionId: string | null
  createdAt: string
}

export type AuditEvent = OperatorSwitchAuditEvent
