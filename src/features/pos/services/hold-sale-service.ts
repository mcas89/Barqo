import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { localDb, type HeldSaleRecord } from '../../../infra/offline/db'
import type { CartItem } from '../types'

export const MAX_HELD_SALES = 3

export type HeldSale = HeldSaleRecord

export async function listHeldSales(input: {
  organizationId: string
  deviceId: string
}): Promise<HeldSale[]> {
  const rows = await localDb.heldSales
    .where('organizationId')
    .equals(input.organizationId)
    .filter((row) => row.deviceId === input.deviceId)
    .toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function countHeldSales(input: {
  organizationId: string
  deviceId: string
}): Promise<number> {
  const rows = await listHeldSales(input)
  return rows.length
}

export async function holdCurrentSale(input: {
  organizationId: string
  deviceId: string
  cashSessionId?: string
  cart: CartItem[]
  discountCents: number
  customer: { id: string; name: string; phone?: string } | null
  label?: string
  operatorId?: string
  operatorName?: string
}): Promise<HeldSale> {
  if (input.cart.length === 0) {
    throw new Error('Não há itens para colocar em espera.')
  }

  const existing = await listHeldSales({
    organizationId: input.organizationId,
    deviceId: input.deviceId,
  })
  if (existing.length >= MAX_HELD_SALES) {
    throw new Error(
      `Limite de ${MAX_HELD_SALES} vendas em espera neste aparelho. Retome ou descarte uma antes.`,
    )
  }

  const id = createId('hold')
  const itemCount = input.cart.reduce((sum, item) => sum + item.quantity, 0)
  const label =
    input.label?.trim() ||
    input.customer?.name ||
    `Espera · ${itemCount} item(ns)`

  const record: HeldSale = {
    id,
    organizationId: input.organizationId,
    deviceId: input.deviceId,
    cashSessionId: input.cashSessionId,
    label,
    cart: input.cart.map((item) => ({ ...item })),
    discountCents: Math.max(0, input.discountCents),
    customer: input.customer,
    createdAt: nowIso(),
    heldByOperatorId: input.operatorId,
    heldByOperatorName: input.operatorName,
  }

  await localDb.heldSales.put(record)
  return record
}

export async function getHeldSale(id: string): Promise<HeldSale | null> {
  return (await localDb.heldSales.get(id)) ?? null
}

export async function removeHeldSale(id: string): Promise<void> {
  await localDb.heldSales.delete(id)
}

export async function discardHeldSale(id: string): Promise<void> {
  await removeHeldSale(id)
}
