import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import type { OrganizationId } from '../../../shared/types'
import type { Product } from '../../products/types'
import {
  PREP_STATIONS,
  PREP_STATUSES,
  TICKET_STATUSES,
  ticketItemCount,
  ticketTotalCents,
  type PrepStation,
  type PrepStatus,
  type SalonTable,
  type SalonTableInput,
  type SalonTicket,
  type TicketItem,
} from '../types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  return db
}

function tablesCol(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'salon_tables')
}

function ticketsCol(organizationId: OrganizationId) {
  return collection(requireDb(), 'organizations', organizationId, 'salon_tickets')
}

function mapTable(id: string, data: Record<string, unknown>): SalonTable {
  return {
    id,
    organizationId: data.organizationId as string,
    name: String(data.name ?? ''),
    number: Number(data.number ?? 0),
    sortOrder: Number(data.sortOrder ?? data.number ?? 0),
    active: data.active !== false,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

function mapTicketItem(raw: Record<string, unknown>): TicketItem {
  const quantity = Math.max(0, Number(raw.quantity ?? 0))
  const unitPriceCents = Math.max(0, Math.round(Number(raw.unitPriceCents ?? 0)))
  const item: TicketItem = {
    id: String(raw.id ?? ''),
    productId: String(raw.productId ?? ''),
    name: String(raw.name ?? ''),
    quantity,
    unitPriceCents,
    costCents: Math.max(0, Math.round(Number(raw.costCents ?? 0))),
    totalCents: Math.max(0, Math.round(Number(raw.totalCents ?? quantity * unitPriceCents))),
    type: raw.type === 'service' ? 'service' : 'product',
    station: (raw.station as PrepStation) || PREP_STATIONS.KITCHEN,
    prepStatus: (raw.prepStatus as PrepStatus) || PREP_STATUSES.QUEUED,
    addedAt: String(raw.addedAt ?? ''),
  }
  if (raw.note) item.note = String(raw.note)
  if (raw.addedByOperatorId) item.addedByOperatorId = String(raw.addedByOperatorId)
  if (raw.addedByName) item.addedByName = String(raw.addedByName)
  return item
}

function mapTicket(id: string, data: Record<string, unknown>): SalonTicket {
  const items = Array.isArray(data.items)
    ? data.items.map((item) => mapTicketItem(item as Record<string, unknown>))
    : []
  return {
    id,
    organizationId: data.organizationId as string,
    tableId: String(data.tableId ?? ''),
    tableName: String(data.tableName ?? ''),
    status: (data.status as SalonTicket['status']) || TICKET_STATUSES.OPEN,
    items,
    discountCents: Math.max(0, Math.round(Number(data.discountCents ?? 0))),
    note: data.note ? String(data.note) : undefined,
    customerId: data.customerId ? String(data.customerId) : undefined,
    customerName: data.customerName ? String(data.customerName) : undefined,
    customerPhone: data.customerPhone ? String(data.customerPhone) : undefined,
    openedAt: String(data.openedAt ?? ''),
    openedByOperatorId: String(data.openedByOperatorId ?? ''),
    openedByName: String(data.openedByName ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    closedAt: data.closedAt ? String(data.closedAt) : undefined,
    closedByOperatorId: data.closedByOperatorId
      ? String(data.closedByOperatorId)
      : undefined,
    closedByName: data.closedByName ? String(data.closedByName) : undefined,
    saleId: data.saleId ? String(data.saleId) : undefined,
  }
}

export function defaultPrepStationForProduct(product: Product): PrepStation {
  if (product.prepStation) return product.prepStation
  return product.type === 'service' ? PREP_STATIONS.NONE : PREP_STATIONS.KITCHEN
}

export async function listSalonTables(
  organizationId: OrganizationId,
  options?: { includeInactive?: boolean },
): Promise<SalonTable[]> {
  const snap = await getDocs(tablesCol(organizationId))
  const tables = snap.docs
    .map((item) => mapTable(item.id, item.data()))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number)
  if (options?.includeInactive) return tables
  return tables.filter((table) => table.active)
}

export async function createSalonTable(
  organizationId: OrganizationId,
  input: SalonTableInput,
): Promise<SalonTable> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome da mesa.')
  const number = Math.max(1, Math.round(input.number))
  const existing = await listSalonTables(organizationId, { includeInactive: true })
  if (existing.some((table) => table.active && table.number === number)) {
    throw new Error(`Já existe uma mesa com o número ${number}.`)
  }
  // ID estável por número evita duplicar em corrida (ex.: Strict Mode / 2 abas).
  const id = `mesa-${number}`
  const now = nowIso()
  const table: SalonTable = {
    id,
    organizationId,
    name,
    number,
    sortOrder: input.sortOrder ?? number,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
  }
  const ref = doc(tablesCol(organizationId), id)
  const prior = await getDoc(ref)
  if (prior.exists()) {
    const mapped = mapTable(prior.id, prior.data())
    if (mapped.active) {
      throw new Error(`Já existe uma mesa com o número ${number}.`)
    }
    await updateDoc(
      ref,
      omitUndefined({
        name,
        number,
        sortOrder: input.sortOrder ?? number,
        active: true,
        updatedAt: now,
      }),
    )
    return { ...mapped, name, number, sortOrder: input.sortOrder ?? number, active: true, updatedAt: now }
  }
  await setDoc(ref, omitUndefined({ ...table }))
  return table
}

export async function updateSalonTable(
  organizationId: OrganizationId,
  tableId: string,
  input: SalonTableInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome da mesa.')
  const number = Math.max(1, Math.round(input.number))
  const existing = await listSalonTables(organizationId, { includeInactive: true })
  if (
    existing.some(
      (table) => table.active && table.number === number && table.id !== tableId,
    )
  ) {
    throw new Error(`Já existe uma mesa com o número ${number}.`)
  }
  await updateDoc(
    doc(tablesCol(organizationId), tableId),
    omitUndefined({
      name,
      number,
      sortOrder: input.sortOrder ?? number,
      active: input.active !== false,
      updatedAt: nowIso(),
    }),
  )
}

/** Remove mesas ativas duplicadas pelo mesmo número (mantém a mais antiga). */
export async function dedupeSalonTables(
  organizationId: OrganizationId,
): Promise<SalonTable[]> {
  const existing = await listSalonTables(organizationId, { includeInactive: true })
  const byNumber = new Map<number, SalonTable[]>()
  for (const table of existing.filter((item) => item.active)) {
    const list = byNumber.get(table.number) ?? []
    list.push(table)
    byNumber.set(table.number, list)
  }
  for (const group of byNumber.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const duplicate of sorted.slice(1)) {
      await updateDoc(doc(tablesCol(organizationId), duplicate.id), {
        active: false,
        updatedAt: nowIso(),
      })
    }
  }
  return listSalonTables(organizationId, { includeInactive: true })
}

export async function listOpenTickets(
  organizationId: OrganizationId,
): Promise<SalonTicket[]> {
  const snap = await getDocs(
    query(ticketsCol(organizationId), where('status', '==', TICKET_STATUSES.OPEN)),
  )
  return snap.docs
    .map((item) => mapTicket(item.id, item.data()))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
}

function preferOpenTicket(a: SalonTicket, b: SalonTicket): SalonTicket {
  const aCount = ticketItemCount(a.items)
  const bCount = ticketItemCount(b.items)
  if (aCount !== bCount) return aCount >= bCount ? a : b
  return a.openedAt <= b.openedAt ? a : b
}

/** Uma comanda aberta por mesa (e por nome, se sobrar lixo de mesa duplicada). */
export function uniqueOpenTickets(tickets: SalonTicket[]): SalonTicket[] {
  const byTableId = new Map<string, SalonTicket>()
  for (const ticket of tickets) {
    const prev = byTableId.get(ticket.tableId)
    byTableId.set(ticket.tableId, prev ? preferOpenTicket(prev, ticket) : ticket)
  }
  const byName = new Map<string, SalonTicket>()
  for (const ticket of byTableId.values()) {
    const key = ticket.tableName.trim().toLowerCase()
    const prev = byName.get(key)
    byName.set(key, prev ? preferOpenTicket(prev, ticket) : ticket)
  }
  return [...byName.values()].sort((a, b) =>
    a.tableName.localeCompare(b.tableName, 'pt-BR'),
  )
}

async function cancelDuplicateOpenTicket(input: {
  organizationId: OrganizationId
  ticketId: string
}): Promise<void> {
  await updateDoc(
    doc(ticketsCol(input.organizationId), input.ticketId),
    omitUndefined({
      status: TICKET_STATUSES.CANCELED,
      closedAt: nowIso(),
      updatedAt: nowIso(),
      note: 'Comanda duplicada cancelada automaticamente',
    }),
  )
}

/** Une itens e cancela comandas abertas duplicadas da mesma mesa. */
export async function dedupeOpenTickets(
  organizationId: OrganizationId,
): Promise<SalonTicket[]> {
  const open = await listOpenTickets(organizationId)
  const byTableId = new Map<string, SalonTicket[]>()
  for (const ticket of open) {
    const list = byTableId.get(ticket.tableId) ?? []
    list.push(ticket)
    byTableId.set(ticket.tableId, list)
  }

  for (const group of byTableId.values()) {
    if (group.length < 2) continue
    const keep = group.reduce((best, ticket) => preferOpenTicket(best, ticket))
    const mergedItems = [...keep.items]
    for (const dup of group) {
      if (dup.id === keep.id) continue
      for (const item of dup.items) {
        if (item.prepStatus === PREP_STATUSES.CANCELED) continue
        if (mergedItems.some((row) => row.id === item.id)) continue
        mergedItems.push(item)
      }
      await cancelDuplicateOpenTicket({ organizationId, ticketId: dup.id })
    }
    if (mergedItems.length !== keep.items.length) {
      const updatedAt = nowIso()
      await updateDoc(
        doc(ticketsCol(organizationId), keep.id),
        omitUndefined({
          items: mergedItems.map((row) => omitUndefined({ ...row } as Record<string, unknown>)),
          updatedAt,
        }),
      )
    }
  }

  // Mesas duplicadas (ids diferentes, mesmo nome): junta na comanda preferida.
  const afterTablePass = await listOpenTickets(organizationId)
  const byName = new Map<string, SalonTicket[]>()
  for (const ticket of afterTablePass) {
    const key = ticket.tableName.trim().toLowerCase()
    const list = byName.get(key) ?? []
    list.push(ticket)
    byName.set(key, list)
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue
    const keep = group.reduce((best, ticket) => preferOpenTicket(best, ticket))
    const mergedItems = [...keep.items]
    for (const dup of group) {
      if (dup.id === keep.id) continue
      for (const item of dup.items) {
        if (item.prepStatus === PREP_STATUSES.CANCELED) continue
        if (mergedItems.some((row) => row.id === item.id)) continue
        mergedItems.push(item)
      }
      await cancelDuplicateOpenTicket({ organizationId, ticketId: dup.id })
    }
    if (mergedItems.length !== keep.items.length) {
      await updateDoc(
        doc(ticketsCol(organizationId), keep.id),
        omitUndefined({
          items: mergedItems.map((row) => omitUndefined({ ...row } as Record<string, unknown>)),
          updatedAt: nowIso(),
        }),
      )
    }
  }

  return listOpenTickets(organizationId)
}

export function subscribeOpenTickets(
  organizationId: OrganizationId,
  onData: (tickets: SalonTicket[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(ticketsCol(organizationId), where('status', '==', TICKET_STATUSES.OPEN)),
    (snap) => {
      const tickets = snap.docs
        .map((item) => mapTicket(item.id, item.data()))
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
      onData(uniqueOpenTickets(tickets))
    },
    (err) => onError?.(err),
  )
}

export async function getTicket(
  organizationId: OrganizationId,
  ticketId: string,
): Promise<SalonTicket | null> {
  const snap = await getDoc(doc(ticketsCol(organizationId), ticketId))
  if (!snap.exists()) return null
  return mapTicket(snap.id, snap.data())
}

export async function openTicketForTable(input: {
  organizationId: OrganizationId
  table: SalonTable
  operatorId: string
  operatorName: string
}): Promise<SalonTicket> {
  // Limpa corridas (Strict Mode / 2 toques) antes de reutilizar.
  const open = await dedupeOpenTickets(input.organizationId)
  const existing = open.find((ticket) => ticket.tableId === input.table.id)
  if (existing) return existing

  const id = createId('tkt')
  const now = nowIso()
  const ticket: SalonTicket = {
    id,
    organizationId: input.organizationId,
    tableId: input.table.id,
    tableName: input.table.name,
    status: TICKET_STATUSES.OPEN,
    items: [],
    discountCents: 0,
    openedAt: now,
    openedByOperatorId: input.operatorId,
    openedByName: input.operatorName,
    updatedAt: now,
  }
  await setDoc(doc(ticketsCol(input.organizationId), id), omitUndefined({ ...ticket }))
  return ticket
}

export type TicketItemDraft = {
  product: Product
  quantity: number
  note?: string
}

function buildTicketItem(input: {
  product: Product
  quantity: number
  note?: string
  operatorId: string
  operatorName: string
  addedAt: string
}): TicketItem {
  const quantity = Math.max(1, Number(input.quantity) || 1)
  const station = defaultPrepStationForProduct(input.product)
  const note = input.note?.trim()
  const item: TicketItem = {
    id: createId('ti'),
    productId: input.product.id,
    name: input.product.name,
    quantity,
    unitPriceCents: input.product.priceCents,
    costCents: input.product.costCents,
    totalCents: input.product.priceCents * quantity,
    type: input.product.type,
    station,
    prepStatus:
      station === PREP_STATIONS.NONE ? PREP_STATUSES.DELIVERED : PREP_STATUSES.QUEUED,
    addedAt: input.addedAt,
    addedByOperatorId: input.operatorId,
    addedByName: input.operatorName,
  }
  if (note) item.note = note
  return item
}

/** Adiciona vários itens de uma vez (um pedido → uma entrada na cozinha). */
export async function addTicketItems(input: {
  organizationId: OrganizationId
  ticketId: string
  lines: TicketItemDraft[]
  operatorId: string
  operatorName: string
}): Promise<SalonTicket> {
  if (input.lines.length === 0) {
    throw new Error('Adicione itens ao pedido antes de enviar.')
  }
  const ticket = await getTicket(input.organizationId, input.ticketId)
  if (!ticket || ticket.status !== TICKET_STATUSES.OPEN) {
    throw new Error('Comanda não encontrada ou já fechada.')
  }
  const addedAt = nowIso()
  const newItems = input.lines.map((line) =>
    buildTicketItem({
      product: line.product,
      quantity: line.quantity,
      note: line.note,
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      addedAt,
    }),
  )
  const items = [...ticket.items, ...newItems].map((row) =>
    omitUndefined({ ...row } as Record<string, unknown>),
  )
  const updatedAt = addedAt
  await updateDoc(
    doc(ticketsCol(input.organizationId), ticket.id),
    omitUndefined({
      items,
      updatedAt,
    }),
  )
  return { ...ticket, items: items as unknown as TicketItem[], updatedAt }
}

export async function addTicketItem(input: {
  organizationId: OrganizationId
  ticketId: string
  product: Product
  quantity: number
  note?: string
  operatorId: string
  operatorName: string
}): Promise<SalonTicket> {
  return addTicketItems({
    organizationId: input.organizationId,
    ticketId: input.ticketId,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    lines: [{ product: input.product, quantity: input.quantity, note: input.note }],
  })
}

export async function updateTicketItemPrepStatus(input: {
  organizationId: OrganizationId
  ticketId: string
  itemId: string
  prepStatus: PrepStatus
}): Promise<SalonTicket> {
  const ticket = await getTicket(input.organizationId, input.ticketId)
  if (!ticket || ticket.status !== TICKET_STATUSES.OPEN) {
    throw new Error('Comanda não encontrada ou já fechada.')
  }
  const items = ticket.items
    .map((item) =>
      item.id === input.itemId ? { ...item, prepStatus: input.prepStatus } : item,
    )
    .map((row) => omitUndefined({ ...row } as Record<string, unknown>))
  const updatedAt = nowIso()
  await updateDoc(
    doc(ticketsCol(input.organizationId), ticket.id),
    omitUndefined({
      items,
      updatedAt,
    }),
  )
  return { ...ticket, items: items as unknown as TicketItem[], updatedAt }
}

export async function cancelTicketItem(input: {
  organizationId: OrganizationId
  ticketId: string
  itemId: string
}): Promise<SalonTicket> {
  return updateTicketItemPrepStatus({
    ...input,
    prepStatus: PREP_STATUSES.CANCELED,
  })
}

export async function setTicketDiscount(input: {
  organizationId: OrganizationId
  ticketId: string
  discountCents: number
}): Promise<void> {
  await updateDoc(doc(ticketsCol(input.organizationId), input.ticketId), {
    discountCents: Math.max(0, Math.round(input.discountCents)),
    updatedAt: nowIso(),
  })
}

export async function markTicketClosed(input: {
  organizationId: OrganizationId
  ticketId: string
  saleId: string
  operatorId: string
  operatorName: string
}): Promise<void> {
  await updateDoc(
    doc(ticketsCol(input.organizationId), input.ticketId),
    omitUndefined({
      status: TICKET_STATUSES.CLOSED,
      saleId: input.saleId,
      closedAt: nowIso(),
      closedByOperatorId: input.operatorId,
      closedByName: input.operatorName,
      updatedAt: nowIso(),
    }),
  )
}

export async function cancelOpenTicket(input: {
  organizationId: OrganizationId
  ticketId: string
  operatorId: string
  operatorName: string
}): Promise<void> {
  const ticket = await getTicket(input.organizationId, input.ticketId)
  if (!ticket) throw new Error('Comanda não encontrada.')
  if (ticket.status !== TICKET_STATUSES.OPEN) {
    throw new Error('Comanda já está fechada.')
  }
  if (ticketTotalCents(ticket) > 0) {
    throw new Error('Comanda com itens: feche a conta ou remova os produtos antes.')
  }
  await updateDoc(
    doc(ticketsCol(input.organizationId), input.ticketId),
    omitUndefined({
      status: TICKET_STATUSES.CANCELED,
      closedAt: nowIso(),
      closedByOperatorId: input.operatorId,
      closedByName: input.operatorName,
      updatedAt: nowIso(),
    }),
  )
}

export type KitchenQueueCard = {
  ticketId: string
  tableName: string
  item: TicketItem
}

export function buildKitchenQueue(tickets: SalonTicket[]): KitchenQueueCard[] {
  const cards: KitchenQueueCard[] = []
  for (const ticket of tickets) {
    for (const item of ticket.items) {
      if (item.station === PREP_STATIONS.NONE) continue
      if (
        item.prepStatus === PREP_STATUSES.DELIVERED ||
        item.prepStatus === PREP_STATUSES.CANCELED
      ) {
        continue
      }
      cards.push({ ticketId: ticket.id, tableName: ticket.tableName, item })
    }
  }
  return cards.sort((a, b) => a.item.addedAt.localeCompare(b.item.addedAt))
}
