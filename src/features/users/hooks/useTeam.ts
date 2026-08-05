import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  canAddMore,
  getLimitValue,
  planHasFeature,
  upgradeMessageForFeature,
  upgradeMessageForLimit,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import {
  countSeatsUsed,
  createEmployee,
  filterEmployees,
  listEmployees,
  setEmployeeActive,
  updateEmployee,
} from '../services/employee-service'
import type { Employee, EmployeeInput } from '../types'

export function useTeam() {
  const { organization, subscription } = useAuth()
  const { hasPrivilegedAccess } = usePosOperator()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID

  const canManage = hasPrivilegedAccess

  const hasMultiUser = planHasFeature(planId, PLAN_FEATURES.MULTI_USER)
  const maxUsers = getLimitValue(planId, 'users')

  const activeCount = useMemo(
    () => employees.filter((e) => e.active).length,
    [employees],
  )

  // Assentos: dono (1) + funcionários ativos
  const seatsForLimit = countSeatsUsed(activeCount)

  const canAddEmployee =
    canManage && hasMultiUser && canAddMore(planId, 'users', seatsForLimit)

  const blockReason = useMemo(() => {
    if (!canManage) {
      return 'Somente o proprietário ou gerente pode gerenciar a equipe.'
    }
    if (!hasMultiUser) {
      return upgradeMessageForFeature(PLAN_FEATURES.MULTI_USER)
    }
    if (!canAddMore(planId, 'users', seatsForLimit)) {
      return upgradeMessageForLimit('users', planId)
    }
    return null
  }, [canManage, hasMultiUser, planId, seatsForLimit])

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setEmployees([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await listEmployees(organizationId, {
        includeInactive: showInactive,
      })
      setEmployees(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar a equipe.')
    } finally {
      setLoading(false)
    }
  }, [organizationId, showInactive])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = filterEmployees(employees, search)

  async function saveEmployee(input: EmployeeInput, employeeId?: string) {
    if (!organizationId) {
      throw new Error('Nenhuma organização ativa.')
    }
    if (!canManage) {
      throw new Error('Sem permissão para gerenciar a equipe.')
    }

    setSaving(true)
    setError(null)
    try {
      if (employeeId) {
        await updateEmployee(organizationId, employeeId, input)
      } else {
        if (!canAddEmployee) {
          throw new Error(blockReason ?? 'Limite de usuários atingido.')
        }
        await createEmployee(organizationId, input)
      }
      await refresh()
    } catch (err) {
      console.error(err)
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar o funcionário.'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(employee: Employee) {
    if (!organizationId || !canManage) return

    // Reativar precisa de assento livre
    if (!employee.active && !canAddMore(planId, 'users', seatsForLimit)) {
      setError(upgradeMessageForLimit('users', planId))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await setEmployeeActive(organizationId, employee.id, !employee.active)
      await refresh()
    } catch (err) {
      console.error(err)
      setError('Não foi possível atualizar o status.')
    } finally {
      setSaving(false)
    }
  }

  return {
    employees: filtered,
    totalCount: employees.length,
    activeCount,
    seatsUsed: seatsForLimit,
    maxUsers,
    planId,
    hasMultiUser,
    canManage,
    canAddEmployee,
    blockReason,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    refresh,
    saveEmployee,
    toggleActive,
  }
}
