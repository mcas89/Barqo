import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfLocalDayIso } from '../../../shared/lib/dates'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { isOnline } from '../../../infra/offline'
import { PERMISSIONS } from '../../users/permissions'
import { cancelSale, listSalesForManagement } from '../services/sale-service'
import type { Sale } from '../types'
import { usePosOperator } from './usePosOperator'

export function useSaleCancel() {
  const { organization, user } = useAuth()
  const { deviceId, getOperationAccess } = useDeviceSession()
  const { operator, authorizePrivileged, can, pinRequired } = usePosOperator()

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [includeCanceled, setIncludeCanceled] = useState(true)

  const needsPrivilegedPin = pinRequired && !can(PERMISSIONS.CANCEL_SALE)

  const refresh = useCallback(async () => {
    if (!organization?.id) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!isOnline()) {
        throw new Error('É preciso estar online para carregar e cancelar vendas.')
      }
      const list = await listSalesForManagement(organization.id, startOfLocalDayIso())
      setSales(list)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as vendas.')
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sales.filter((sale) => {
      if (!includeCanceled && sale.status === 'canceled') return false
      if (!q) return true
      const hay = [
        sale.id,
        sale.customerName,
        sale.soldByName,
        sale.cancelReason,
        ...(sale.items ?? []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [sales, search, includeCanceled])

  async function cancelWithPin(saleId: string, reason: string, pin?: string) {
    if (!organization?.id || !user) {
      throw new Error('Sessão inválida.')
    }
    if (!operator?.id) {
      throw new Error('Operador não identificado. Desbloqueie o PDV.')
    }

    setBusy(true)
    setError(null)
    try {
      const access = getOperationAccess({
        hasOperator: true,
        requireOperator: true,
        requireCash: false,
      })
      if (!access.allowed) {
        throw new Error(
          access.message ?? 'Acesso bloqueado. Não é possível cancelar vendas.',
        )
      }

      if (needsPrivilegedPin) {
        if (!pin?.trim()) throw new Error('Informe o PIN de autorização.')
        await authorizePrivileged(pin)
      }

      await cancelSale({
        organizationId: organization.id,
        saleId,
        userId: user.id,
        userName: user.displayName || user.email,
        operatorId: operator.id,
        deviceId,
        reason,
      })
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao cancelar a venda.'
      setError(message)
      throw err
    } finally {
      setBusy(false)
    }
  }

  return {
    organization,
    sales: filtered,
    loading,
    busy,
    error,
    setError,
    search,
    setSearch,
    includeCanceled,
    setIncludeCanceled,
    refresh,
    needsPrivilegedPin,
    cancelWithPin,
  }
}
