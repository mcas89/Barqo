import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
  upgradeMessageForFeature,
} from '../../billing'
import {
  endOfLocalDayIso,
  parseLocalDateInput,
  startOfLocalDayIso,
  toLocalDateInput,
} from '../../../shared/lib/dates'
import { useAuth } from '../../../shared/hooks/useAuth'
import { listSalesSince } from '../../cash-register'
import {
  buildPeriodSummary,
  type PeriodSummary,
} from '../services/period-summary'

export type ReportPreset = 'today' | '7d' | '30d' | 'custom'

function rangeFromPreset(preset: ReportPreset, fromInput: string, toInput: string) {
  const today = new Date()
  if (preset === 'today') {
    return {
      fromIso: startOfLocalDayIso(today),
      toIso: endOfLocalDayIso(today),
      fromInput: toLocalDateInput(today),
      toInput: toLocalDateInput(today),
    }
  }

  if (preset === '7d' || preset === '30d') {
    const days = preset === '7d' ? 6 : 29
    const from = new Date(today)
    from.setDate(today.getDate() - days)
    return {
      fromIso: startOfLocalDayIso(from),
      toIso: endOfLocalDayIso(today),
      fromInput: toLocalDateInput(from),
      toInput: toLocalDateInput(today),
    }
  }

  const fromDate = parseLocalDateInput(fromInput)
  const toDate = parseLocalDateInput(toInput)
  return {
    fromIso: startOfLocalDayIso(fromDate),
    toIso: endOfLocalDayIso(toDate),
    fromInput,
    toInput,
  }
}

export function usePeriodReport() {
  const { organization, subscription } = useAuth()
  const today = toLocalDateInput()
  const [preset, setPreset] = useState<ReportPreset>('today')
  const [fromInput, setFromInput] = useState(today)
  const [toInput, setToInput] = useState(today)
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const canUsePeriod = planHasFeature(planId, PLAN_FEATURES.REPORTS_PERIOD)
  const canExport = planHasFeature(planId, PLAN_FEATURES.EXPORT_REPORTS)
  const upgradeHint = upgradeMessageForFeature(PLAN_FEATURES.REPORTS_PERIOD)

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setSummary(null)
      setLoading(false)
      return
    }

    const effectivePreset = canUsePeriod ? preset : 'today'
    const range = rangeFromPreset(effectivePreset, fromInput, toInput)
    if (range.fromIso > range.toIso) {
      setError('A data inicial não pode ser maior que a final.')
      setSummary(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const sales = await listSalesSince(organizationId, range.fromIso, range.toIso)
      setSummary(
        buildPeriodSummary({
          fromIso: range.fromIso,
          toIso: range.toIso,
          sales,
        }),
      )
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o relatório.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, canUsePeriod, preset, fromInput, toInput])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function applyPreset(next: ReportPreset) {
    setPreset(next)
    if (next !== 'custom') {
      const range = rangeFromPreset(next, fromInput, toInput)
      setFromInput(range.fromInput)
      setToInput(range.toInput)
    }
  }

  return {
    organization,
    planId,
    canUsePeriod,
    canExport,
    upgradeHint,
    preset: canUsePeriod ? preset : 'today',
    fromInput,
    toInput,
    setFromInput,
    setToInput,
    applyPreset,
    summary,
    loading,
    error,
    refresh,
  }
}
