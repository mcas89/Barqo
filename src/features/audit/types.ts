import type { OrganizationId } from '../../shared/types'

export const AUDIT_EVENT_TYPES = {
  OPERATOR_SWITCH: 'operator.switch',
  BARCODE_GENERATED: 'product.barcode.generated',
  BARCODE_CHANGED: 'product.barcode.changed',
  LABELS_PRINTED: 'labels.printed',
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

export interface BarcodeAuditEvent {
  id: string
  organizationId: OrganizationId
  type:
    | typeof AUDIT_EVENT_TYPES.BARCODE_GENERATED
    | typeof AUDIT_EVENT_TYPES.BARCODE_CHANGED
  operatorId: string
  deviceId: string
  productId: string
  previousBarcode?: string
  newBarcode?: string
  createdAt: string
}

export interface LabelsPrintedAuditEvent {
  id: string
  organizationId: OrganizationId
  type: typeof AUDIT_EVENT_TYPES.LABELS_PRINTED
  operatorId: string
  deviceId: string
  modelId: string
  totalLabels: number
  productIds: string[]
  createdAt: string
}

export type AuditEvent =
  | OperatorSwitchAuditEvent
  | BarcodeAuditEvent
  | LabelsPrintedAuditEvent
