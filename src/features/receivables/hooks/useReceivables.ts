import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
  upgradeMessageForFeature,
} from '../../billing'
import { resolvePersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { listCustomers, type Customer } from '../../customers'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import {
  createReceivable,
  filterReceivables,
  listReceivables,
  receivePayment,
  sumOpenCents,
} from '../services/receivable-service'
import type {
  CreateReceivableInput,
  ReceivePaymentInput,
  Receivable,
} from '../types'

export function useReceivables() {
  const { organization, user, subscription } = useAuth()
  const { operator } = usePosOperator()
  const { deviceId, getOperationAccess } = useDeviceSession()
  const [items, setItems] = useState<Receivable[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [includePaid, setIncludePaid] = useState(false)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const hasReceivables = planHasFeature(planId, PLAN_FEATURES.RECEIVABLES)
  const upgradeHint = upgradeMessageForFeature(PLAN_FEATURES.RECEIVABLES)

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setItems([])
      setCustomers([])
      setLoading(false)
      return
    }

    if (!hasReceivables) {
      setItems([])
      setCustomers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [receivables, customerList] = await Promise.all([
        listReceivables(organizationId, { includePaid }),
        listCustomers(organizationId),
      ])
      setItems(receivables)
      setCustomers(customerList)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar as contas a receber.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, includePaid, hasReceivables])

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

  const filtered = filterReceivables(items, search)
  const openTotalCents = sumOpenCents(
    items.filter((item) => item.status === 'open' || item.status === 'partial'),
  )

  async function addReceivable(data: CreateReceivableInput) {
    const actor = requireActor()
    if (!hasReceivables) throw new Error(upgradeHint)

    setSaving(true)
    setError(null)
    try {
      await createReceivable({
        organizationId: actor.organizationId,
        userId: actor.user.id,
        userName: actor.actorName,
        operatorId: actor.operator.id,
        deviceId: actor.deviceId,
        data,
      })
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível criar o fiado.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function payReceivable(receivableId: string, data: ReceivePaymentInput) {
    const actor = requireActor()

    setSaving(true)
    setError(null)
    try {
      await receivePayment({
        organizationId: actor.organizationId,
        receivableId,
        userId: actor.user.id,
        userName: actor.actorName,
        operatorId: actor.operator.id,
        deviceId: actor.deviceId,
        data,
      })
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível registrar o recebimento.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  return {
    organization,
    hasReceivables,
    upgradeHint,
    planId,
    items: filtered,
    openTotalCents,
    customers,
    loading,
    saving,
    error,
    search,
    setSearch,
    includePaid,
    setIncludePaid,
    refresh,
    addReceivable,
    payReceivable,
  }
}
