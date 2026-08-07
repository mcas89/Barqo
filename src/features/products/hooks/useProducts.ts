import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  canAddMore,
  DEFAULT_PLAN_ID,
  getLimitValue,
  getPlan,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  createProduct,
  filterProducts,
  listProducts,
  setProductActive,
  updateProduct,
} from '../services/product-service'
import type { Product, ProductInput } from '../types'

export function useProducts() {
  const { organization, subscription } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const maxProducts = getLimitValue(planId, 'products')
  const plan = getPlan(planId)

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setProducts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await listProducts(organizationId, { includeInactive: showInactive })
      setProducts(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os produtos.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, showInactive])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const activeCount = useMemo(
    () => products.filter((product) => product.active).length,
    [products],
  )
  const canAddProduct = canAddMore(planId, 'products', activeCount)

  const filtered = filterProducts(products, search)

  function findByBarcode(barcode: string) {
    const code = barcode.trim().toLowerCase()
    if (!code) return null
    return (
      products.find((product) => product.barcode?.trim().toLowerCase() === code) ?? null
    )
  }

  async function saveProduct(input: ProductInput, productId?: string) {
    if (!organizationId) {
      throw new Error('Nenhuma organização ativa.')
    }

    setSaving(true)
    setError(null)
    try {
      if (productId) {
        await updateProduct(organizationId, productId, input, planId)
      } else {
        await createProduct(organizationId, input, planId)
      }
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o produto.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(product: Product) {
    if (!organizationId) return
    setSaving(true)
    setError(null)
    try {
      await setProductActive(organizationId, product.id, !product.active, planId)
      await refresh()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar o status do produto.',
      )
    } finally {
      setSaving(false)
    }
  }

  return {
    products: filtered,
    allProducts: products,
    totalCount: products.length,
    activeCount,
    maxProducts,
    planId,
    planName: plan.name,
    canAddProduct,
    loading,
    saving,
    error,
    setErrorMessage: setError,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    refresh,
    saveProduct,
    toggleActive,
    findByBarcode,
  }
}
