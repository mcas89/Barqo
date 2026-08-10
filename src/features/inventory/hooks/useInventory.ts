import { useCallback, useEffect, useState } from 'react'
import { resolvePersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import type { Product } from '../../products'
import {
  filterInventoryProducts,
  isLowStock,
  listInventoryCatalog,
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
  const { operator } = usePosOperator()
  const { deviceId, getOperationAccess } = useDeviceSession()
  const [catalog, setCatalog] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)

  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setCatalog([])
      setMovements([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [productList, movementList] = await Promise.all([
        listInventoryCatalog(organizationId),
        listStockMovements(organizationId, { max: 60 }),
      ])
      setCatalog(productList)
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

  function requireActor() {
    if (!organizationId || !user) throw new Error('Sessão inválida.')
    if (!operator) throw new Error('Desbloqueie o PDV com o PIN do operador.')
    const access = getOperationAccess({
      hasOperator: true,
      requireOperator: true,
    })
    if (!access.allowed) {
      throw new Error(access.message ?? 'Operação não permitida neste aparelho.')
    }
    return {
      organizationId,
      user,
      operator,
      deviceId,
      actorName: operator.displayName || resolvePersonName(user.displayName, 'Proprietário'),
    }
  }

  async function runMovement(
    action: () => Promise<StockMovement>,
  ): Promise<void> {
    requireActor()
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

  const stockProducts = catalog.filter((product) => product.type === 'product')

  return {
    organization,
    products: filterInventoryProducts(stockProducts, search, onlyLowStock),
    catalog,
    allProducts: stockProducts,
    lowStockCount: stockProducts.filter(isLowStock).length,
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
      const actor = requireActor()
      await runMovement(() =>
        registerStockEntry({
          organizationId: actor.organizationId,
          userId: actor.user.id,
          userName: actor.actorName,
          operatorId: actor.operator.id,
          deviceId: actor.deviceId,
          data,
        }),
      )
    },
    async addLoss(data: StockLossInput) {
      const actor = requireActor()
      await runMovement(() =>
        registerStockLoss({
          organizationId: actor.organizationId,
          userId: actor.user.id,
          userName: actor.actorName,
          operatorId: actor.operator.id,
          deviceId: actor.deviceId,
          data,
        }),
      )
    },
    async adjustStock(data: StockAdjustmentInput) {
      const actor = requireActor()
      await runMovement(() =>
        registerStockAdjustment({
          organizationId: actor.organizationId,
          userId: actor.user.id,
          userName: actor.actorName,
          operatorId: actor.operator.id,
          deviceId: actor.deviceId,
          data,
        }),
      )
    },
  }
}
