import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_PLAN_ID, getLimitValue } from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { getLocalDeviceId } from '../lib/device-id'
import {
  claimDeviceSlot,
  heartbeatDevice,
  listOrgDevices,
  removeOrgDevice,
} from '../services/device-service'
import { DEVICE_HEARTBEAT_MS, type OrgDevice } from '../types'

interface DeviceSessionContextValue {
  deviceId: string
  devices: OrgDevice[]
  maxDevices: number
  loading: boolean
  blocked: boolean
  error: string | null
  refreshDevices: () => Promise<void>
  removeDevice: (deviceId: string) => Promise<void>
  retry: () => Promise<void>
}

const DeviceSessionContext = createContext<DeviceSessionContextValue | null>(null)

export function DeviceSessionProvider({ children }: { children: ReactNode }) {
  const { organization, user, subscription } = useAuth()
  const [devices, setDevices] = useState<OrgDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deviceId = getLocalDeviceId()

  const organizationId = organization?.id
  const planId =
    subscription?.planId ?? organization?.planId ?? DEFAULT_PLAN_ID
  const maxDevices = getLimitValue(planId, 'devices')

  const refreshDevices = useCallback(async () => {
    if (!organizationId) {
      setDevices([])
      return
    }
    setDevices(await listOrgDevices(organizationId))
  }, [organizationId])

  const claim = useCallback(async () => {
    if (!organizationId || !user) {
      setBlocked(false)
      setError(null)
      setLoading(false)
      setDevices([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      await claimDeviceSlot({
        organizationId,
        planId,
        maxDevices,
      })
      setBlocked(false)
      await refreshDevices()
    } catch (err) {
      setBlocked(true)
      setError(err instanceof Error ? err.message : 'Não foi possível validar este aparelho.')
      await refreshDevices().catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }, [organizationId, user, planId, maxDevices, refreshDevices])

  useEffect(() => {
    void claim()
  }, [claim])

  useEffect(() => {
    if (!organizationId || !user || blocked) return undefined

    const tick = () => {
      void heartbeatDevice(organizationId).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, DEVICE_HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [organizationId, user, blocked])

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

  const value = useMemo<DeviceSessionContextValue>(
    () => ({
      deviceId,
      devices,
      maxDevices,
      loading,
      blocked,
      error,
      refreshDevices,
      removeDevice,
      retry: claim,
    }),
    [
      deviceId,
      devices,
      maxDevices,
      loading,
      blocked,
      error,
      refreshDevices,
      removeDevice,
      claim,
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
