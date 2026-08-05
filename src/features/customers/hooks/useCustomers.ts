import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  createCustomer,
  filterCustomers,
  listCustomers,
  setCustomerActive,
  updateCustomer,
} from '../services/customer-service'
import type { Customer, CustomerInput } from '../types'

export function useCustomers() {
  const { organization } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setCustomers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await listCustomers(organizationId, {
        includeInactive: showInactive,
      })
      setCustomers(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os clientes.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, showInactive])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function saveCustomer(input: CustomerInput, customerId?: string) {
    if (!organizationId) throw new Error('Nenhuma organização ativa.')

    setSaving(true)
    setError(null)
    try {
      if (customerId) {
        await updateCustomer(organizationId, customerId, input)
      } else {
        await createCustomer(organizationId, input)
      }
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar o cliente.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(customer: Customer) {
    if (!organizationId) return
    setSaving(true)
    setError(null)
    try {
      await setCustomerActive(organizationId, customer.id, !customer.active)
      await refresh()
    } catch (err) {
      console.error(err)
      setError('Não foi possível atualizar o status.')
    } finally {
      setSaving(false)
    }
  }

  return {
    customers: filterCustomers(customers, search),
    totalCount: customers.length,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    refresh,
    saveCustomer,
    toggleActive,
  }
}
