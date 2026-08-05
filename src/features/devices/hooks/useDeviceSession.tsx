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
  getLimitValue,
  getSubscriptionCoverage,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { isOnline } from '../../../infra/offline'
import { getLocalDeviceId, resolveLocalDeviceId } from '../lib/device-id'
import {
  authorizeOrgDevice,
  blockOrgDevice,
  claimDeviceSlot,
  DeviceBlockedError,
  DeviceLimitError,
  DeviceRemovedError,
  heartbeatDevice,
  listOrgDevices,
  removeOrgDevice,
  renameOrgDevice,
  renewDeviceLease,
} from '../services/device-service'
import {
  buildSubscriptionLease,
  evaluateDeviceAccess,
  getDeviceLease,
  getSubscriptionLease,
  saveSubscriptionLease,
} from '../services/lease-store'
import {
  buildDeviceWarning,
  buildSubscriptionWarning,
  canStartOperationalAction,
  deviceStateAllowsOperate,
} from '../services/operation-access'
import {
  DEVICE_LEASE_HEARTBEAT_MS,
  DEVICE_PRESENCE_HEARTBEAT_MS,
  type DeviceAccessState,
  type DeviceLease,
  type LocalSubscriptionLease,
  type OperationAccess,
  type OrgDevice,
} from '../types'

interface DeviceSessionContextValue {
  deviceId: string
  devices: OrgDevice[]
  maxDevices: number
  loading: boolean
  /** Limite de aparelhos do plano — impede entrar no app. */
  slotBlocked: boolean
  /** Estado de acesso operacional deste aparelho. */
  accessState: DeviceAccessState
  /** true se não pode vender/abrir caixa etc. */
  operationLimited: boolean
  error: string | null
  warning: string | null
  deviceLease: DeviceLease | null
  subscriptionLease: LocalSubscriptionLease | null
  refreshDevices: () => Promise<void>
  removeDevice: (deviceId: string) => Promise<void>
  blockDevice: (deviceId: string) => Promise<void>
  authorizeDevice: (deviceId: string) => Promise<void>
  renameDevice: (deviceId: string, label: string) => Promise<void>
  retry: () => Promise<void>
  getOperationAccess: (opts?: {
    hasOperator?: boolean
    hasOpenCash?: boolean
    requireOperator?: boolean
    requireCash?: boolean
  }) => OperationAccess
}

const DeviceSessionContext = createContext<DeviceSessionContextValue | null>(null)

export function DeviceSessionProvider({ children }: { children: ReactNode }) {
  const { organization, user, subscription } = useAuth()
  const [devices, setDevices] = useState<OrgDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [slotBlocked, setSlotBlocked] = useState(false)
  const [accessState, setAccessState] = useState<DeviceAccessState>('limited')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [deviceLease, setDeviceLease] = useState<DeviceLease | null>(null)
  const [subscriptionLease, setSubscriptionLease] = useState<LocalSubscriptionLease | null>(
    null,
  )
  const [deviceId, setDeviceId] = useState(() => getLocalDeviceId())

  const organizationId = organization?.id
  const userId = user?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const maxDevices = getLimitValue(planId, 'devices')
  const coverage = useMemo(
    () => getSubscriptionCoverage(subscription),
    [
      subscription?.organizationId,
      subscription?.planId,
      subscription?.status,
      subscription?.trialEndsAt,
      subscription?.paidThrough,
      subscription?.graceUntil,
      subscription?.billingCycle,
      subscription?.updatedAt,
    ],
  )
  const canOperateOnline = coverage?.canOperate === true
  const coverageStatus = coverage?.effectiveStatus ?? ''
  const coveragePlanId = coverage?.planId ?? planId
  const hasCoverage = coverage !== null

  const refreshLocalLeases = useCallback(async () => {
    if (!organizationId) {
      setDeviceLease(null)
      setSubscriptionLease(null)
      setAccessState('limited')
      setWarning(null)
      return
    }
    const [devLease, subLease] = await Promise.all([
      getDeviceLease(organizationId),
      getSubscriptionLease(organizationId),
    ])
    setDeviceLease(devLease)
    setSubscriptionLease(subLease)
    const state = evaluateDeviceAccess(devLease)
    setAccessState(state)
    setWarning(
      buildDeviceWarning(devLease, state) || buildSubscriptionWarning(subLease),
    )
  }, [organizationId])

  const refreshDevices = useCallback(async () => {
    if (!organizationId) {
      setDevices([])
      return
    }
    setDevices(await listOrgDevices(organizationId))
  }, [organizationId])

  const syncSubscriptionLeaseOnline = useCallback(async () => {
    if (!organizationId || !hasCoverage) return
    if (!isOnline()) return
    const lease = buildSubscriptionLease({
      organizationId,
      planId: coveragePlanId,
      subscriptionStatus: coverageStatus,
      canOperateOnline,
    })
    await saveSubscriptionLease(lease)
    setSubscriptionLease(lease)
  }, [organizationId, hasCoverage, coveragePlanId, coverageStatus, canOperateOnline])

  const claim = useCallback(async () => {
    if (!organizationId || !userId) {
      setSlotBlocked(false)
      setError(null)
      setLoading(false)
      setDevices([])
      setAccessState('limited')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const id = await resolveLocalDeviceId()
      setDeviceId(id)

      if (!isOnline()) {
        await refreshLocalLeases()
        setSlotBlocked(false)
        await refreshDevices().catch(() => undefined)
        return
      }

      try {
        await claimDeviceSlot({
          organizationId,
          planId,
          maxDevices,
          userId,
        })
        setSlotBlocked(false)
        await syncSubscriptionLeaseOnline()
        await refreshLocalLeases()
        await refreshDevices()
      } catch (err) {
        if (err instanceof DeviceLimitError) {
          setSlotBlocked(true)
          setError(err.message)
        } else if (err instanceof DeviceBlockedError) {
          setSlotBlocked(false)
          setError(err.message)
          setAccessState('blocked')
          await refreshLocalLeases()
        } else if (err instanceof DeviceRemovedError) {
          setSlotBlocked(false)
          setError(err.message)
          setAccessState('removed')
          await refreshLocalLeases()
        } else {
          // rede/ falha: tenta operar com lease local
          await refreshLocalLeases()
          setSlotBlocked(false)
          setError(err instanceof Error ? err.message : 'Falha ao validar aparelho.')
        }
        await refreshDevices().catch(() => undefined)
      }
    } finally {
      setLoading(false)
    }
  }, [
    organizationId,
    userId,
    planId,
    maxDevices,
    refreshDevices,
    refreshLocalLeases,
    syncSubscriptionLeaseOnline,
  ])

  useEffect(() => {
    void claim()
  }, [claim])

  // Presença (curto)
  useEffect(() => {
    if (!organizationId || !userId || slotBlocked) return undefined
    if (accessState === 'blocked' || accessState === 'removed') return undefined

    const tick = () => {
      void heartbeatDevice(organizationId).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, DEVICE_PRESENCE_HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [organizationId, userId, slotBlocked, accessState])

  // Lease renew (15 min) + focus + online
  useEffect(() => {
    if (!organizationId || !userId || slotBlocked) return undefined

    const renew = () => {
      if (!isOnline()) {
        void refreshLocalLeases()
        return
      }
      void renewDeviceLease(organizationId)
        .then(async () => {
          await syncSubscriptionLeaseOnline()
          await refreshLocalLeases()
          setError(null)
        })
        .catch(async (err) => {
          if (err instanceof DeviceBlockedError) {
            setAccessState('blocked')
            setError(err.message)
          } else if (err instanceof DeviceRemovedError) {
            setAccessState('removed')
            setError(err.message)
          }
          await refreshLocalLeases()
        })
    }

    renew()
    const timer = window.setInterval(renew, DEVICE_LEASE_HEARTBEAT_MS)

    const onFocus = () => renew()
    const onOnline = () => renew()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [
    organizationId,
    userId,
    slotBlocked,
    refreshLocalLeases,
    syncSubscriptionLeaseOnline,
  ])

  const removeDevice = useCallback(
    async (id: string) => {
      if (!organizationId) return
      await removeOrgDevice(organizationId, id)
      if (id === deviceId) {
        await claim()
        return
      }
      await refreshDevices()
    },
    [organizationId, deviceId, claim, refreshDevices],
  )

  const blockDevice = useCallback(
    async (id: string) => {
      if (!organizationId || !userId) return
      await blockOrgDevice(organizationId, id, userId)
      await refreshDevices()
      if (id === deviceId) await claim()
    },
    [organizationId, userId, refreshDevices, deviceId, claim],
  )

  const authorizeDevice = useCallback(
    async (id: string) => {
      if (!organizationId || !userId) return
      await authorizeOrgDevice(organizationId, id, userId)
      await refreshDevices()
      if (id === deviceId) await claim()
    },
    [organizationId, userId, refreshDevices, deviceId, claim],
  )

  const renameDevice = useCallback(
    async (id: string, label: string) => {
      if (!organizationId) return
      await renameOrgDevice(organizationId, id, label)
      await refreshDevices()
    },
    [organizationId, refreshDevices],
  )

  const getOperationAccess = useCallback(
    (opts?: {
      hasOperator?: boolean
      hasOpenCash?: boolean
      requireOperator?: boolean
      requireCash?: boolean
    }): OperationAccess => {
      return canStartOperationalAction({
        deviceLease,
        subscriptionLease,
        subscriptionOnlineOk: isOnline() ? canOperateOnline : undefined,
        online: isOnline(),
        hasOperator: opts?.hasOperator,
        hasOpenCash: opts?.hasOpenCash,
        requireOperator: opts?.requireOperator,
        requireCash: opts?.requireCash,
      })
    },
    [deviceLease, subscriptionLease, canOperateOnline],
  )

  const operationLimited = !deviceStateAllowsOperate(accessState) ||
    (isOnline()
      ? !coverage?.canOperate
      : !subscriptionLease?.canOperateOnline ||
        (subscriptionLease
          ? Date.now() > Date.parse(subscriptionLease.offlineAllowedUntil)
          : true))

  const value = useMemo<DeviceSessionContextValue>(
    () => ({
      deviceId,
      devices,
      maxDevices,
      loading,
      slotBlocked,
      accessState,
      operationLimited:
        operationLimited ||
        accessState === 'blocked' ||
        accessState === 'removed' ||
        accessState === 'limited' ||
        accessState === 'clock_invalid',
      error,
      warning,
      deviceLease,
      subscriptionLease,
      refreshDevices,
      removeDevice,
      blockDevice,
      authorizeDevice,
      renameDevice,
      retry: claim,
      getOperationAccess,
    }),
    [
      deviceId,
      devices,
      maxDevices,
      loading,
      slotBlocked,
      accessState,
      operationLimited,
      error,
      warning,
      deviceLease,
      subscriptionLease,
      refreshDevices,
      removeDevice,
      blockDevice,
      authorizeDevice,
      renameDevice,
      claim,
      getOperationAccess,
    ],
  )

  return (
    <DeviceSessionContext.Provider value={value}>{children}</DeviceSessionContext.Provider>
  )
}

export function useDeviceSession() {
  const ctx = useContext(DeviceSessionContext)
  if (!ctx) {
    throw new Error('useDeviceSession deve ser usado dentro de DeviceSessionProvider.')
  }
  return ctx
}
