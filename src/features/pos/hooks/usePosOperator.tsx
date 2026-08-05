import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
} from '../../billing'
import { recordOperatorSwitch } from '../../audit'
import { getOpenCashSession } from '../../cash-register/services/cash-service'
import {
  claimOperatorPresence,
  heartbeatDevice,
  releaseOperatorPresence,
  useDeviceSession,
} from '../../devices'
import { DEVICE_HEARTBEAT_MS } from '../../devices/types'
import { pickPersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  authorizePrivilegedPin,
  clearOperatorSession,
  listPosOperators,
  readOperatorSession,
  setOwnerPosPin,
  toOperatorSession,
  unlockOperator,
  writeOperatorSession,
} from '../services/operator-service'
import {
  canAccessBackOffice,
  canRemoveCartItem,
  sessionCan,
  type PosOperator,
  type PosOperatorSession,
} from '../types/operator'
import {
  PERMISSIONS,
  type PermissionKey,
} from '../../users/permissions'

interface PosOperatorContextValue {
  operators: PosOperator[]
  operator: PosOperatorSession | null
  loading: boolean
  error: string | null
  /** Plano Entrada: dono entra no PDV sem PIN. */
  pinRequired: boolean
  /** Página liberada temporariamente com PIN de dono/gerente. */
  elevatedPath: string | null
  clearError: () => void
  refreshOperators: () => Promise<void>
  unlock: (operatorId: string, pin: string) => Promise<PosOperatorSession>
  lock: () => void
  setupOwnerPin: (pin: string) => Promise<void>
  authorizePrivileged: (pin: string) => Promise<PosOperator>
  elevateForPath: (path: string, pin: string) => Promise<void>
  clearElevation: () => void
  isElevatedFor: (path: string) => boolean
  can: (key: PermissionKey) => boolean
  canAccessBackOffice: boolean
  canRemoveCartItem: boolean
  hasPrivilegedAccess: boolean
}

const PosOperatorContext = createContext<PosOperatorContextValue | null>(null)

function ownerLabel(user: { displayName: string; email: string }) {
  return pickPersonName([user.displayName])
}

export function PosOperatorProvider({ children }: { children: ReactNode }) {
  const { organization, user, subscription } = useAuth()
  const { blocked: deviceBlocked, loading: deviceLoading, deviceId } = useDeviceSession()
  const [operators, setOperators] = useState<PosOperator[]>([])
  const [operator, setOperator] = useState<PosOperatorSession | null>(null)
  const [elevatedPath, setElevatedPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const pinRequired = planHasFeature(planId, PLAN_FEATURES.MULTI_USER)

  const refreshOperators = useCallback(async () => {
    if (!organizationId || !user) {
      setOperators([])
      setOperator(null)
      setLoading(false)
      return
    }

    if (deviceLoading) {
      setLoading(true)
      return
    }

    if (deviceBlocked) {
      setOperators([])
      setOperator(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const list = await listPosOperators({
        organizationId,
        owner: {
          id: user.id,
          displayName: ownerLabel(user),
        },
        ownerNameFallback: organization?.ownerName,
      })
      setOperators(list)

      const planUsesPin = planHasFeature(
        subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID,
        PLAN_FEATURES.MULTI_USER,
      )

      if (!planUsesPin) {
        const owner = list.find((op) => op.kind === 'owner') ?? list[0]
        if (owner) {
          await claimOperatorPresence({
            organizationId,
            operatorId: owner.id,
            displayName: owner.displayName,
            role: owner.role,
          })
          const session = toOperatorSession(owner, planId)
          writeOperatorSession(organizationId, session)
          setOperator(session)
        } else {
          setOperator(null)
        }
        return
      }

      const stored = readOperatorSession(organizationId)
      if (stored && list.some((op) => op.id === stored.id && op.hasPin)) {
        const current = list.find((op) => op.id === stored.id)
        try {
          await claimOperatorPresence({
            organizationId,
            operatorId: stored.id,
            displayName: current?.displayName ?? stored.displayName,
            role: stored.role,
          })
          const session = current
            ? toOperatorSession(current, planId)
            : {
                ...stored,
                permissions:
                  stored.permissions ??
                  toOperatorSession(
                    {
                      id: stored.id,
                      kind: stored.kind,
                      displayName: stored.displayName,
                      role: stored.role,
                      hasPin: true,
                      pinHash: null,
                    },
                    planId,
                  ).permissions,
              }
          writeOperatorSession(organizationId, session)
          setOperator(session)
        } catch (err) {
          clearOperatorSession(organizationId)
          setOperator(null)
          setError(
            err instanceof Error ? err.message : 'Este usuário já está em outro aparelho.',
          )
        }
      } else {
        setOperator(null)
        clearOperatorSession(organizationId)
      }
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os operadores.')
      setOperators([])
      setOperator(null)
    } finally {
      setLoading(false)
    }
  }, [
    organizationId,
    user,
    subscription?.planId,
    organization?.planId,
    organization?.ownerName,
    deviceBlocked,
    deviceLoading,
    planId,
  ])

  useEffect(() => {
    void refreshOperators()
  }, [refreshOperators])

  useEffect(() => {
    if (!organizationId || !operator) return undefined
    const tick = () => {
      void heartbeatDevice(organizationId, operator.id).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, DEVICE_HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [organizationId, operator])

  const unlock = useCallback(
    async (operatorId: string, pin: string) => {
      if (!organizationId || !user) throw new Error('Loja não encontrada.')

      setError(null)
      try {
        const previous = operator
        const list = await listPosOperators({
          organizationId,
          owner: {
            id: user.id,
            displayName: ownerLabel(user),
          },
          ownerNameFallback: organization?.ownerName,
        })
        setOperators(list)

        const target = list.find((op) => op.id === operatorId)
        if (!target) throw new Error('Operador não encontrado.')

        const session = await unlockOperator(organizationId, target, pin, planId)
        await claimOperatorPresence({
          organizationId,
          operatorId: session.id,
          displayName: session.displayName,
          role: session.role,
        })

        let cashSessionId: string | null = null
        try {
          const openCash = await getOpenCashSession(organizationId)
          cashSessionId = openCash?.id ?? null
        } catch {
          cashSessionId = null
        }

        try {
          await recordOperatorSwitch({
            organizationId,
            previousOperatorId: previous?.id ?? null,
            previousOperatorName: previous?.displayName ?? null,
            newOperatorId: session.id,
            newOperatorName: session.displayName,
            deviceId,
            cashSessionId,
          })
        } catch (auditErr) {
          console.warn('Falha ao registrar troca de operador', auditErr)
        }

        writeOperatorSession(organizationId, session)
        setElevatedPath(null)
        setOperator(session)
        return session
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao desbloquear.'
        setError(message)
        throw err
      }
    },
    [organizationId, user, organization?.ownerName, planId, operator, deviceId],
  )

  const lock = useCallback(() => {
    if (!pinRequired) return
    if (organizationId && operator) {
      void releaseOperatorPresence(organizationId, operator.id)
    }
    if (organizationId) clearOperatorSession(organizationId)
    setOperator(null)
    setElevatedPath(null)
    setError(null)
  }, [organizationId, pinRequired, operator])

  const setupOwnerPin = useCallback(
    async (pin: string) => {
      if (!organizationId || !user) throw new Error('Sessão inválida.')
      setError(null)
      try {
        await setOwnerPosPin(organizationId, user.id, pin)
        await refreshOperators()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao salvar PIN.'
        setError(message)
        throw err
      }
    },
    [organizationId, user, refreshOperators],
  )

  const authorizePrivileged = useCallback(
    async (pin: string) => {
      if (!organizationId || !user) throw new Error('Loja não encontrada.')
      if (!pinRequired) {
        const owner = operators.find((op) => op.kind === 'owner')
        if (owner) return owner
        throw new Error('Operador proprietário não encontrado.')
      }
      const list = await listPosOperators({
        organizationId,
        owner: {
          id: user.id,
          displayName: ownerLabel(user),
        },
        ownerNameFallback: organization?.ownerName,
      })
      setOperators(list)
      return authorizePrivilegedPin(organizationId, list, pin)
    },
    [organizationId, user, pinRequired, operators, organization?.ownerName],
  )

  const clearElevation = useCallback(() => {
    setElevatedPath(null)
  }, [])

  const isElevatedFor = useCallback(
    (path: string) => Boolean(elevatedPath && path === elevatedPath),
    [elevatedPath],
  )

  const elevateForPath = useCallback(
    async (path: string, pin: string) => {
      await authorizePrivileged(pin)
      setElevatedPath(path)
    },
    [authorizePrivileged],
  )

  const value = useMemo<PosOperatorContextValue>(() => {
    const can = (key: PermissionKey) => {
      if (!pinRequired) return true
      if (elevatedPath) return true
      return sessionCan(operator, key)
    }
    const backOffice = !pinRequired
      ? true
      : operator
        ? sessionCan(operator, PERMISSIONS.BACK_OFFICE) ||
          canAccessBackOffice(operator.role)
        : false
    const removeCart = !pinRequired
      ? true
      : operator
        ? sessionCan(operator, PERMISSIONS.REMOVE_CART) ||
          canRemoveCartItem(operator.role)
        : false

    return {
      operators,
      operator,
      loading,
      error,
      pinRequired,
      elevatedPath,
      clearError: () => setError(null),
      refreshOperators,
      unlock,
      lock,
      setupOwnerPin,
      authorizePrivileged,
      elevateForPath,
      clearElevation,
      isElevatedFor,
      can,
      canAccessBackOffice: backOffice,
      canRemoveCartItem: removeCart,
      hasPrivilegedAccess: !pinRequired
        ? true
        : Boolean(elevatedPath) ||
          Boolean(
            operator &&
              (sessionCan(operator, PERMISSIONS.BACK_OFFICE) ||
                canAccessBackOffice(operator.role)),
          ),
    }
  }, [
    operators,
    operator,
    elevatedPath,
    loading,
    error,
    pinRequired,
    refreshOperators,
    unlock,
    lock,
    setupOwnerPin,
    authorizePrivileged,
    elevateForPath,
    clearElevation,
    isElevatedFor,
  ])

  return (
    <PosOperatorContext.Provider value={value}>{children}</PosOperatorContext.Provider>
  )
}

export function usePosOperator() {
  const ctx = useContext(PosOperatorContext)
  if (!ctx) {
    throw new Error('usePosOperator deve ser usado dentro de PosOperatorProvider.')
  }
  return ctx
}
