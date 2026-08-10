import { useCallback, useEffect, useState } from 'react'
import { startOfLocalDayIso } from '../../../shared/lib/dates'
import { pickPersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  getOpenCashSession,
  listSalesSince,
} from '../../cash-register'
import { listProducts } from '../../products'
import { listEmployees } from '../../users'
import { buildDaySummary, type DaySummary } from '../services/day-summary'
import {
  buildActorNameMap,
  resolveActorDisplayName,
} from '../services/actor-names'

export function useDayDashboard() {
  const { organization, user } = useAuth()
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
      const [sales, products, cash, employees] = await Promise.all([
        listSalesSince(organizationId, fromIso),
        listProducts(organizationId, { includeInactive: false }),
        getOpenCashSession(organizationId),
        listEmployees(organizationId, { includeInactive: true }),
      ])

      const actors = employees.map((employee) => ({
        id: employee.id,
        displayName: employee.displayName,
      }))
      if (user?.id) {
        actors.push({
          id: user.id,
          displayName:
            pickPersonName([user.displayName, organization?.ownerName]) ||
            user.displayName ||
            'Proprietário',
        })
      }
      const actorNames = buildActorNameMap(actors)

      setSummary(
        buildDaySummary({
          fromIso,
          sales,
          products,
          cashOpen: Boolean(cash),
          cashOpenedByName: resolveActorDisplayName(
            [cash?.openedByOperatorId, cash?.openedByUserId],
            cash?.openedByName,
            actorNames,
            '—',
          ),
          actorNames,
        }),
      )
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o painel do dia.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [organizationId, user?.id, user?.displayName, organization?.ownerName])

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
