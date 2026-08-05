import type { ReactNode } from 'react'
import { AuthProvider } from '../shared/hooks/useAuth'
import { DeviceSessionProvider } from '../features/devices'
import { PosOperatorProvider } from '../features/pos/hooks/usePosOperator'
import { PendingCheckoutWatcher } from '../features/billing/hooks/usePendingCheckoutWatcher'
import { SyncBootstrap } from '../infra/sync/SyncBootstrap'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PendingCheckoutWatcher />
      <DeviceSessionProvider>
        <PosOperatorProvider>
          <SyncBootstrap />
          {children}
        </PosOperatorProvider>
      </DeviceSessionProvider>
    </AuthProvider>
  )
}
