import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  createSupplier,
  filterSuppliers,
  listSuppliers,
  setSupplierActive,
  updateSupplier,
} from '../services/supplier-service'
import type { Supplier, SupplierInput } from '../types'

export function useSuppliers() {
  const { organization } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setSuppliers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await listSuppliers(organizationId, {
        includeInactive: showInactive,
      })
      setSuppliers(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os fornecedores.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, showInactive])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function saveSupplier(input: SupplierInput, supplierId?: string) {
    if (!organizationId) throw new Error('Nenhuma organização ativa.')

    setSaving(true)
    setError(null)
    try {
      if (supplierId) {
        await updateSupplier(organizationId, supplierId, input)
      } else {
        await createSupplier(organizationId, input)
      }
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar o fornecedor.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(supplier: Supplier) {
    if (!organizationId) return
    setSaving(true)
    setError(null)
    try {
      await setSupplierActive(organizationId, supplier.id, !supplier.active)
      await refresh()
    } catch (err) {
      console.error(err)
      setError('Não foi possível atualizar o status.')
    } finally {
      setSaving(false)
    }
  }

  return {
    suppliers: filterSuppliers(suppliers, search),
    totalCount: suppliers.length,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    refresh,
    saveSupplier,
    toggleActive,
  }
}
