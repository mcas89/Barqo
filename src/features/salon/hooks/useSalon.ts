import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
  upgradeMessageForFeature,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { listProducts } from '../../products'
import type { Product } from '../../products'
import { PERMISSIONS } from '../../users/permissions'
import {
  addTicketItem,
  addTicketItems,
  buildKitchenQueue,
  cancelTicketItem,
  dedupeSalonTables,
  dedupeOpenTickets,
  listSalonTables,
  markTicketClosed,
  openTicketForTable,
  setTicketDiscount,
  subscribeOpenTickets,
  updateSalonTable,
  updateTicketItemPrepStatus,
  createSalonTable,
  cancelOpenTicket,
} from '../services/salon-service'
import type { PrepStatus, SalonTable, SalonTicket } from '../types'
import { ticketTotalCents } from '../types'

export function useSalon() {
  const { organization, subscription, user } = useAuth()
  const { operator, can, pinRequired } = usePosOperator()
  const [tables, setTables] = useState<SalonTable[]>([])
  const [tickets, setTickets] = useState<SalonTicket[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const hasSalon = planHasFeature(planId, PLAN_FEATURES.SALON)
  const upgradeHint = upgradeMessageForFeature(PLAN_FEATURES.SALON)

  const canTables = !pinRequired || can(PERMISSIONS.SALON_TABLES)
  const canWaiter = !pinRequired || can(PERMISSIONS.SALON_WAITER)
  const canKitchen = !pinRequired || can(PERMISSIONS.SALON_KITCHEN)
  const canClose = !pinRequired || can(PERMISSIONS.SALON_CLOSE)

  const ticketByTableId = useMemo(() => {
    const map = new Map<string, SalonTicket>()
    for (const ticket of tickets) map.set(ticket.tableId, ticket)
    return map
  }, [tickets])

  const kitchenQueue = useMemo(() => buildKitchenQueue(tickets), [tickets])

  const refreshTables = useCallback(async () => {
    if (!organizationId || !hasSalon) {
      setTables([])
      return
    }
    let list = await listSalonTables(organizationId, { includeInactive: true })
    list = await dedupeSalonTables(organizationId)
    await dedupeOpenTickets(organizationId)
    setTables(list)
  }, [organizationId, hasSalon])

  const refreshProducts = useCallback(async () => {
    if (!organizationId || !hasSalon) {
      setProducts([])
      return
    }
    const list = await listProducts(organizationId, { includeInactive: false })
    setProducts(list.filter((product) => product.active))
  }, [organizationId, hasSalon])

  useEffect(() => {
    if (!organizationId || !hasSalon) {
      setLoading(false)
      setTickets([])
      setTables([])
      return
    }

    setLoading(true)
    setError(null)
    void Promise.all([refreshTables(), refreshProducts()])
      .catch((err) => {
        console.error(err)
        setError('Não foi possível carregar o salão.')
      })
      .finally(() => setLoading(false))

    const unsub = subscribeOpenTickets(
      organizationId,
      (next) => setTickets(next),
      (err) => {
        console.error(err)
        setError('Falha ao sincronizar comandas.')
      },
    )
    return () => unsub()
  }, [organizationId, hasSalon, refreshTables, refreshProducts])

  async function openOrGetTicket(table: SalonTable) {
    if (!organizationId || !operator) throw new Error('Operador não desbloqueado.')
    setBusy(true)
    setError(null)
    try {
      return await openTicketForTable({
        organizationId,
        table,
        operatorId: operator.id,
        operatorName: operator.displayName,
      })
    } finally {
      setBusy(false)
    }
  }

  async function addProductToTicket(input: {
    ticketId: string
    product: Product
    quantity: number
    note?: string
  }) {
    if (!organizationId || !operator) throw new Error('Operador não desbloqueado.')
    setBusy(true)
    setError(null)
    try {
      return await addTicketItem({
        organizationId,
        ticketId: input.ticketId,
        product: input.product,
        quantity: input.quantity,
        note: input.note,
        operatorId: operator.id,
        operatorName: operator.displayName,
      })
    } finally {
      setBusy(false)
    }
  }

  /** Envia o carrinho completo à comanda/cozinha de uma vez. */
  async function sendOrderToTicket(input: {
    ticketId: string
    lines: Array<{ product: Product; quantity: number; note?: string }>
  }) {
    if (!organizationId || !operator) throw new Error('Operador não desbloqueado.')
    setBusy(true)
    setError(null)
    try {
      return await addTicketItems({
        organizationId,
        ticketId: input.ticketId,
        lines: input.lines,
        operatorId: operator.id,
        operatorName: operator.displayName,
      })
    } finally {
      setBusy(false)
    }
  }

  async function setPrepStatus(ticketId: string, itemId: string, prepStatus: PrepStatus) {
    if (!organizationId) return
    setBusy(true)
    try {
      await updateTicketItemPrepStatus({
        organizationId,
        ticketId,
        itemId,
        prepStatus,
      })
    } finally {
      setBusy(false)
    }
  }

  async function removeTicketItem(ticketId: string, itemId: string) {
    if (!organizationId) return
    setBusy(true)
    setError(null)
    try {
      return await cancelTicketItem({
        organizationId,
        ticketId,
        itemId,
      })
    } finally {
      setBusy(false)
    }
  }

  async function applyDiscount(ticketId: string, discountCents: number) {
    if (!organizationId) return
    await setTicketDiscount({ organizationId, ticketId, discountCents })
  }

  async function closeTicketAfterSale(ticketId: string, saleId: string) {
    if (!organizationId || !operator) throw new Error('Operador não desbloqueado.')
    await markTicketClosed({
      organizationId,
      ticketId,
      saleId,
      operatorId: operator.id,
      operatorName: operator.displayName,
    })
  }

  async function voidEmptyTicket(ticketId: string) {
    if (!organizationId || !operator) return
    await cancelOpenTicket({
      organizationId,
      ticketId,
      operatorId: operator.id,
      operatorName: operator.displayName,
    })
  }

  async function addTable(name: string, number: number) {
    if (!organizationId) return
    setBusy(true)
    try {
      await createSalonTable(organizationId, { name, number, sortOrder: number })
      await refreshTables()
    } finally {
      setBusy(false)
    }
  }

  async function toggleTableActive(table: SalonTable) {
    if (!organizationId) return
    setBusy(true)
    try {
      await updateSalonTable(organizationId, table.id, {
        name: table.name,
        number: table.number,
        sortOrder: table.sortOrder,
        active: !table.active,
      })
      await refreshTables()
    } finally {
      setBusy(false)
    }
  }

  return {
    organization,
    user,
    operator,
    hasSalon,
    upgradeHint,
    canTables,
    canWaiter,
    canKitchen,
    canClose,
    tables,
    tickets,
    products,
    ticketByTableId,
    kitchenQueue,
    loading,
    error,
    busy,
    ticketTotalCents,
    openOrGetTicket,
    addProductToTicket,
    sendOrderToTicket,
    removeTicketItem,
    setPrepStatus,
    applyDiscount,
    closeTicketAfterSale,
    voidEmptyTicket,
    addTable,
    toggleTableActive,
    refreshTables,
    refreshProducts,
    setError,
  }
}
