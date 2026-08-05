import type { Sale } from '../../features/pos/types'
import type { CashSession } from '../../features/cash-register/types'
import { nowIso } from '../../shared/lib/dates'
import { localDb, type LocalCashSessionRecord, type LocalSaleRecord } from './db'

export async function saveLocalSale(sale: Sale, synced: boolean): Promise<void> {
  const record: LocalSaleRecord = {
    id: sale.id,
    organizationId: sale.organizationId,
    createdAt: sale.createdAt,
    synced,
    sale,
  }
  await localDb.localSales.put(record)
}

export async function markLocalSaleSynced(saleId: string): Promise<void> {
  await localDb.localSales.update(saleId, { synced: true })
}

export async function listLocalSales(
  organizationId: string,
  options?: { pendingOnly?: boolean },
): Promise<Sale[]> {
  let rows = await localDb.localSales
    .where('organizationId')
    .equals(organizationId)
    .reverse()
    .sortBy('createdAt')
  if (options?.pendingOnly) rows = rows.filter((row) => !row.synced)
  return rows.map((row) => row.sale)
}

export async function countPendingSales(organizationId?: string): Promise<number> {
  if (!organizationId) {
    return localDb.localSales.filter((row) => !row.synced).count()
  }
  return localDb.localSales
    .where('organizationId')
    .equals(organizationId)
    .filter((row) => !row.synced)
    .count()
}

export async function saveLocalCashSession(
  session: CashSession,
  synced: boolean,
): Promise<void> {
  const record: LocalCashSessionRecord = {
    id: session.id,
    organizationId: session.organizationId,
    status: session.status === 'open' ? 'open' : 'closed',
    synced,
    session,
    updatedAt: nowIso(),
  }
  await localDb.cashSessions.put(record)
}

export async function getLocalOpenCashSession(
  organizationId: string,
): Promise<CashSession | null> {
  const rows = await localDb.cashSessions
    .where('organizationId')
    .equals(organizationId)
    .filter((row) => row.status === 'open')
    .toArray()
  if (rows.length === 0) return null
  rows.sort((left, right) => right.session.openedAt.localeCompare(left.session.openedAt))
  return rows[0]?.session ?? null
}

export async function markLocalCashSynced(sessionId: string): Promise<void> {
  await localDb.cashSessions.update(sessionId, { synced: true, updatedAt: nowIso() })
}
