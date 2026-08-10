import type { OrganizationId } from '../../shared/types'
import type { ProductType } from '../products/types'

export const PREP_STATIONS = {
  KITCHEN: 'kitchen',
  BAR: 'bar',
  NONE: 'none',
} as const

export type PrepStation = (typeof PREP_STATIONS)[keyof typeof PREP_STATIONS]

export const PREP_STATION_LABELS: Record<PrepStation, string> = {
  kitchen: 'Cozinha',
  bar: 'Bar',
  none: 'Só na conta (sem fila)',
}

export const PREP_STATUSES = {
  QUEUED: 'queued',
  PREPARING: 'preparing',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELED: 'canceled',
} as const

export type PrepStatus = (typeof PREP_STATUSES)[keyof typeof PREP_STATUSES]

export const PREP_STATUS_LABELS: Record<PrepStatus, string> = {
  queued: 'Na fila',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  canceled: 'Cancelado',
}

export const TICKET_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELED: 'canceled',
} as const

export type TicketStatus = (typeof TICKET_STATUSES)[keyof typeof TICKET_STATUSES]

export interface SalonTable {
  id: string
  organizationId: OrganizationId
  name: string
  number: number
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SalonTableInput {
  name: string
  number: number
  sortOrder?: number
  active?: boolean
}

export interface TicketItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  costCents: number
  totalCents: number
  type: ProductType
  note?: string
  station: PrepStation
  prepStatus: PrepStatus
  addedAt: string
  addedByOperatorId?: string
  addedByName?: string
}

export interface SalonTicket {
  id: string
  organizationId: OrganizationId
  tableId: string
  tableName: string
  status: TicketStatus
  items: TicketItem[]
  discountCents: number
  note?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  openedAt: string
  openedByOperatorId: string
  openedByName: string
  updatedAt: string
  closedAt?: string
  closedByOperatorId?: string
  closedByName?: string
  saleId?: string
}

export function ticketSubtotalCents(items: TicketItem[]): number {
  return items
    .filter((item) => item.prepStatus !== PREP_STATUSES.CANCELED)
    .reduce((sum, item) => sum + item.totalCents, 0)
}

export function ticketTotalCents(ticket: Pick<SalonTicket, 'items' | 'discountCents'>): number {
  return Math.max(0, ticketSubtotalCents(ticket.items) - Math.max(0, ticket.discountCents))
}

export function ticketItemCount(items: TicketItem[]): number {
  return items
    .filter((item) => item.prepStatus !== PREP_STATUSES.CANCELED)
    .reduce((sum, item) => sum + item.quantity, 0)
}
