import { useCallback, useEffect, useState } from 'react'
import { startOfLocalDayIso } from '../../../shared/lib/dates'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  getOpenCashSession,
  listSalesSince,
} from '../../cash-register'
import { listProducts } from '../../products'
import { buildDaySummary, type DaySummary } from '../services/day-summary'

export function useDayDashboard() {
  const { organization } = useAuth()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const organizationId = organization?.id

  const refresh = useCallback(async (silent = false) => {
    if (!organizationId) {
      setSummary(null)
      setLoading(false)
      return
    }

    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const fromIso = startOfLocalDayIso()
      const [sales, products, cash] = await Promise.all([
        listSalesSince(organizationId, fromIso),
        listProducts(organizationId, { includeInactive: false }),
        getOpenCashSession(organizationId),
      ])

      setSummary(
        buildDaySummary({
          fromIso,
          sales,
          products,
          cashOpen: Boolean(cash),
          cashOpenedByName: cash?.openedByName,
        }),
      )
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o painel do dia.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [organizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    organization,
    summary,
    loading,
    refreshing,
    error,
    refresh,
  }
}
