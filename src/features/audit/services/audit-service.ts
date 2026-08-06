import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId } from '../../../shared/types'
import {
  AUDIT_EVENT_TYPES,
  type AuditEvent,
  type BarcodeAuditEvent,
  type LabelsPrintedAuditEvent,
  type OperatorSwitchAuditEvent,
  type SaleCanceledAuditEvent,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

export async function recordOperatorSwitch(input: {
  organizationId: OrganizationId
  previousOperatorId: string | null
  previousOperatorName: string | null
  newOperatorId: string
  newOperatorName: string
  deviceId: string
  cashSessionId?: string | null
}): Promise<OperatorSwitchAuditEvent> {
  if (!input.deviceId.trim()) {
    throw new Error('Dispositivo não identificado.')
  }
  if (!input.newOperatorId.trim()) {
    throw new Error('Operador novo não identificado.')
  }

  // Mesmo operador no mesmo aparelho: não gera ruído (ex.: restore de sessão).
  if (
    input.previousOperatorId &&
    input.previousOperatorId === input.newOperatorId
  ) {
    return {
      id: 'skip',
      organizationId: input.organizationId,
      type: AUDIT_EVENT_TYPES.OPERATOR_SWITCH,
      previousOperatorId: input.previousOperatorId,
      previousOperatorName: input.previousOperatorName,
      newOperatorId: input.newOperatorId,
      newOperatorName: input.newOperatorName,
      deviceId: input.deviceId,
      cashSessionId: input.cashSessionId ?? null,
      createdAt: nowIso(),
    }
  }

  const id = createId('aud')
  const event: OperatorSwitchAuditEvent = {
    id,
    organizationId: input.organizationId,
    type: AUDIT_EVENT_TYPES.OPERATOR_SWITCH,
    previousOperatorId: input.previousOperatorId,
    previousOperatorName: input.previousOperatorName,
    newOperatorId: input.newOperatorId,
    newOperatorName: input.newOperatorName,
    deviceId: input.deviceId,
    cashSessionId: input.cashSessionId ?? null,
    createdAt: nowIso(),
  }

  await setDoc(
    doc(requireDb(), 'organizations', input.organizationId, 'audit_events', id),
    omitUndefined({ ...event }),
  )

  return event
}

export async function recordBarcodeAudit(input: {
  organizationId: OrganizationId
  type: 'product.barcode.generated' | 'product.barcode.changed'
  productId: string
  operatorId: string
  deviceId: string
  previousBarcode?: string
  newBarcode?: string
}): Promise<BarcodeAuditEvent | null> {
  if (!isFirebaseReady()) return null
  try {
    const id = createId('aud')
    const event: BarcodeAuditEvent = {
      id,
      organizationId: input.organizationId,
      type:
        input.type === 'product.barcode.generated'
          ? AUDIT_EVENT_TYPES.BARCODE_GENERATED
          : AUDIT_EVENT_TYPES.BARCODE_CHANGED,
      operatorId: input.operatorId,
      deviceId: input.deviceId || 'unknown',
      productId: input.productId,
      previousBarcode: input.previousBarcode,
      newBarcode: input.newBarcode,
      createdAt: nowIso(),
    }
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'audit_events', id),
      omitUndefined({ ...event }),
    )
    return event
  } catch {
    return null
  }
}

export async function recordLabelsPrinted(input: {
  organizationId: OrganizationId
  operatorId: string
  deviceId: string
  modelId: string
  totalLabels: number
  productIds: string[]
}): Promise<LabelsPrintedAuditEvent | null> {
  if (!isFirebaseReady()) return null
  try {
    const id = createId('aud')
    const event: LabelsPrintedAuditEvent = {
      id,
      organizationId: input.organizationId,
      type: AUDIT_EVENT_TYPES.LABELS_PRINTED,
      operatorId: input.operatorId,
      deviceId: input.deviceId || 'unknown',
      modelId: input.modelId,
      totalLabels: input.totalLabels,
      productIds: input.productIds,
      createdAt: nowIso(),
    }
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'audit_events', id),
      omitUndefined({ ...event }),
    )
    return event
  } catch {
    return null
  }
}

export async function recordSaleCanceled(input: {
  organizationId: OrganizationId
  saleId: string
  totalCents: number
  operatorId: string
  deviceId: string
  reason: string
}): Promise<SaleCanceledAuditEvent | null> {
  if (!isFirebaseReady()) return null
  try {
    const id = createId('aud')
    const event: SaleCanceledAuditEvent = {
      id,
      organizationId: input.organizationId,
      type: AUDIT_EVENT_TYPES.SALE_CANCELED,
      saleId: input.saleId,
      totalCents: input.totalCents,
      operatorId: input.operatorId,
      deviceId: input.deviceId || 'unknown',
      reason: input.reason,
      createdAt: nowIso(),
    }
    await setDoc(
      doc(requireDb(), 'organizations', input.organizationId, 'audit_events', id),
      omitUndefined({ ...event }),
    )
    return event
  } catch {
    return null
  }
}

function isFirebaseReady(): boolean {
  return Boolean(getFirestoreDb())
}

export async function listAuditEvents(
  organizationId: OrganizationId,
  options?: { type?: string; max?: number },
): Promise<AuditEvent[]> {
  const col = collection(requireDb(), 'organizations', organizationId, 'audit_events')
  const max = options?.max ?? 50

  let snap
  if (options?.type) {
    snap = await getDocs(
      query(col, where('type', '==', options.type), limit(max)),
    )
  } else {
    snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(max)))
  }

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as AuditEvent)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
