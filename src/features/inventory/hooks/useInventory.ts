import { useCallback, useEffect, useState } from 'react'
import { resolvePersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'
import type { Product } from '../../products'
import {
  filterInventoryProducts,
  listInventoryProducts,
  listStockMovements,
  registerStockAdjustment,
  registerStockEntry,
  registerStockLoss,
} from '../services/inventory-service'
import type {
  StockAdjustmentInput,
  StockEntryInput,
  StockLossInput,
  StockMovement,
} from '../types'

export function useInventory() {
  const { organization, user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)

  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setProducts([])
      setMovements([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [productList, movementList] = await Promise.all([
        listInventoryProducts(organizationId),
        listStockMovements(organizationId, { max: 60 }),
      ])
      setProducts(productList)
      setMovements(movementList)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o estoque.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function runMovement(
    action: () => Promise<StockMovement>,
  ): Promise<void> {
    if (!organizationId || !user) {
      throw new Error('Sessão inválida.')
    }
    setSaving(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível atualizar o estoque.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const actorName = resolvePersonName(user?.displayName, 'Proprietário')

  return {
    organization,
    products: filterInventoryProducts(products, search, onlyLowStock),
    allProducts: products,
    lowStockCount: products.filter(
      (p) => p.minStock > 0 && p.stock <= p.minStock,
    ).length,
    movements,
    loading,
    saving,
    error,
    search,
    setSearch,
    onlyLowStock,
    setOnlyLowStock,
    refresh,
    async addEntry(data: StockEntryInput) {
      if (!organizationId || !user) throw new Error('Sessão inválida.')
      await runMovement(() =>
        registerStockEntry({
          organizationId,
          userId: user.id,
          userName: actorName,
          data,
        }),
      )
    },
    async addLoss(data: StockLossInput) {
      if (!organizationId || !user) throw new Error('Sessão inválida.')
      await runMovement(() =>
        registerStockLoss({
          organizationId,
          userId: user.id,
          userName: actorName,
          data,
        }),
      )
    },
    async adjustStock(data: StockAdjustmentInput) {
      if (!organizationId || !user) throw new Error('Sessão inválida.')
      await runMovement(() =>
        registerStockAdjustment({
          organizationId,
          userId: user.id,
          userName: actorName,
          data,
        }),
      )
    },
  }
}
