import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { AppLayout } from './layouts/AppLayout'
import { PosLayout } from './layouts/PosLayout'
import { RequireDeviceAccess } from './layouts/RequireDeviceAccess'
import { RequireOperatorUnlock } from './layouts/RequireOperatorUnlock'
import { RequireSubscriptionAccess } from './layouts/RequireSubscriptionAccess'
import { LoginPage, RedirectIfAuthenticated, RequireAuth } from '../features/auth'
import { OnboardingPage } from '../features/onboarding'
import { HomePage, ReportsPage } from '../features/reports'
import { PosPage } from '../features/pos'
import { ProductsPage } from '../features/products'
import { CustomersPage } from '../features/customers'
import { CashRegisterPage } from '../features/cash-register'
import { InventoryPage } from '../features/inventory'
import { ReceivablesPage } from '../features/receivables'
import { SettingsPage } from '../features/settings'
import { BillingPage, BillingReturnPage } from '../features/billing'
import { SuppliersPage } from '../features/suppliers'
import { TeamPage } from '../features/users'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      <Route
        path="/billing/retorno"
        element={
          <RequireAuth>
            <BillingReturnPage />
          </RequireAuth>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireDeviceAccess>
              <RequireSubscriptionAccess>
                <RequireOperatorUnlock>
                  <AppLayout />
                </RequireOperatorUnlock>
              </RequireSubscriptionAccess>
            </RequireDeviceAccess>
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="cash" element={<CashRegisterPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="receivables" element={<ReceivablesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      <Route
        path="/app/pos"
        element={
          <RequireAuth>
            <RequireDeviceAccess>
              <RequireSubscriptionAccess>
                <RequireOperatorUnlock>
                  <PosLayout />
                </RequireOperatorUnlock>
              </RequireSubscriptionAccess>
            </RequireDeviceAccess>
          </RequireAuth>
        }
      >
        <Route index element={<PosPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
