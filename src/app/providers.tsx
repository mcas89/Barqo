import type { ReactNode } from 'react'
import { AuthProvider } from '../shared/hooks/useAuth'
import { DeviceSessionProvider } from '../features/devices'
import { PosOperatorProvider } from '../features/pos/hooks/usePosOperator'
import { PendingCheckoutWatcher } from '../features/billing/hooks/usePendingCheckoutWatcher'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PendingCheckoutWatcher />
      <DeviceSessionProvider>
        <PosOperatorProvider>{children}</PosOperatorProvider>
      </DeviceSessionProvider>
    </AuthProvider>
  )
}
