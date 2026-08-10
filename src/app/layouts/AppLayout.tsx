import { useEffect, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BarChart3,
  Boxes,
  CreditCard,
  CircleHelp,
  ChefHat,
  Home,
  LogOut,
  MoreHorizontal,
  Package,
  RefreshCw,
  Settings,
  Store,
  Truck,
  Undo2,
  UserCog,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { themeCssVars } from '../../shared/constants'
import { BrandMark } from '../../shared/components/BrandMark'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDocumentTheme } from '../../shared/hooks/useDocumentTheme'
import { USER_ROLES } from '../../shared/constants'
import { getPlan, PLAN_FEATURES, planHasFeature } from '../../features/billing'
import { PendingCheckoutBanner } from '../../features/billing/components/PendingCheckoutBanner'
import { AccessNoticeBanner } from '../../features/devices'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { POS_ROLE_LABELS } from '../../features/pos/types/operator'
import {
  PERMISSIONS,
  type PermissionKey,
} from '../../features/users/permissions'
import { RequireBackOffice } from './RequireBackOffice'
import './AppLayout.css'

const NAV: Array<{
  to: string
  label: string
  end?: boolean
  permission?: PermissionKey | null
  icon: LucideIcon
}> = [
  { to: '/app', label: 'Início', end: true, permission: PERMISSIONS.BACK_OFFICE, icon: Home },
  { to: '/app/pos', label: 'PDV', permission: null, icon: Store },
  { to: '/app/salon', label: 'Mesas', permission: PERMISSIONS.SALON_TABLES, icon: UtensilsCrossed },
  { to: '/app/salon/waiter', label: 'Garçom', permission: PERMISSIONS.SALON_WAITER, icon: UserRound },
  { to: '/app/salon/kitchen', label: 'Cozinha', permission: PERMISSIONS.SALON_KITCHEN, icon: ChefHat },
  { to: '/app/products', label: 'Produtos', permission: PERMISSIONS.MANAGE_PRODUCTS, icon: Package },
  { to: '/app/customers', label: 'Clientes', permission: PERMISSIONS.MANAGE_CUSTOMERS, icon: Users },
  { to: '/app/receivables', label: 'Fiado', permission: PERMISSIONS.MANAGE_RECEIVABLES, icon: Wallet },
  { to: '/app/cash', label: 'Caixa', permission: PERMISSIONS.MANAGE_CASH, icon: Banknote },
  { to: '/app/sales', label: 'Cancelar', permission: PERMISSIONS.CANCEL_SALE, icon: Undo2 },
  { to: '/app/team', label: 'Equipe', permission: PERMISSIONS.MANAGE_TEAM, icon: UserCog },
  { to: '/app/inventory', label: 'Estoque', permission: PERMISSIONS.MANAGE_INVENTORY, icon: Boxes },
  { to: '/app/suppliers', label: 'Fornecedores', permission: PERMISSIONS.MANAGE_SUPPLIERS, icon: Truck },
  { to: '/app/reports', label: 'Relatórios', permission: PERMISSIONS.VIEW_REPORTS, icon: BarChart3 },
  { to: '/app/sync', label: 'Sync', permission: null, icon: RefreshCw },
  { to: '/app/help', label: 'Ajuda', permission: null, icon: CircleHelp },
  { to: '/app/billing', label: 'Planos', permission: PERMISSIONS.MANAGE_BILLING, icon: CreditCard },
  { to: '/app/settings', label: 'Config', permission: PERMISSIONS.MANAGE_SETTINGS, icon: Settings },
]

const PRIMARY_NAV = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/pos', label: 'PDV' },
  { to: '/app/products', label: 'Produtos' },
  { to: '/app/cash', label: 'Caixa' },
]

const ICON_SIZE = 18
const TAB_ICON_SIZE = 20

function pathMatches(pathname: string, to: string, end?: boolean) {
  if (end || to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppLayout() {
  const { user, organization, subscription, logout } = useAuth()
  const { operator, pinRequired, lock, can } = usePosOperator()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const planId = subscription?.planId ?? organization?.planId
  const hasSalon = planId ? planHasFeature(planId, PLAN_FEATURES.SALON) : false
  const planName = subscription
    ? getPlan(subscription.planId).name
    : organization?.planId
      ? getPlan(organization.planId).name
      : '—'

  useDocumentTheme(organization?.themeColor)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const visibleNav = NAV.filter((item) => {
    if (!hasSalon && item.to.startsWith('/app/salon')) {
      return false
    }
    // Garçom: só a página Garçom (+ trocar usuário no rodapé).
    if (operator?.role === USER_ROLES.WAITER) {
      return item.to === '/app/salon/waiter'
    }
    // Cozinheiro: só a Cozinha.
    if (operator?.role === USER_ROLES.COOK) {
      return item.to === '/app/salon/kitchen'
    }
    if (item.permission == null) return true
    if (!pinRequired) return true
    return can(item.permission)
  })
  const primaryNav = PRIMARY_NAV.map((item) => {
    const full = visibleNav.find((nav) => nav.to === item.to)
    return full ? { ...item, icon: full.icon } : null
  }).filter((item): item is (typeof PRIMARY_NAV)[number] & { icon: LucideIcon } => Boolean(item))
  const moreNav = visibleNav.filter(
    (item) => !PRIMARY_NAV.some((primary) => primary.to === item.to),
  )
  const moreActive = moreNav.some((item) => pathMatches(location.pathname, item.to, item.end))

  return (
    <div
      className={moreOpen ? 'app-layout app-layout--more-open' : 'app-layout'}
      style={themeCssVars(organization?.themeColor) as CSSProperties}
    >
        <header className="app-layout__topbar">
          <BrandMark organization={organization} compact />
          <ConnectionStatus />
        </header>

        <aside className="app-layout__sidebar">
          <div className="app-layout__sidebar-head">
            <BrandMark organization={organization} />
          </div>
          {organization && (
            <div className="app-layout__org">
              <strong>{organization.name}</strong>
              <span>Plano {planName}</span>
            </div>
          )}
          <nav className="app-layout__nav" aria-label="Principal">
            {visibleNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? 'app-layout__link app-layout__link--active' : 'app-layout__link'
                  }
                >
                  <Icon size={ICON_SIZE} strokeWidth={2} aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="app-layout__footer">
            <span className="app-layout__user">
              {operator
                ? `${operator.displayName} · ${POS_ROLE_LABELS[operator.role]}`
                : (user?.displayName ?? user?.email)}
            </span>
            {pinRequired && (
              <button type="button" className="app-layout__logout" onClick={lock}>
                <UserRound size={ICON_SIZE} strokeWidth={2} aria-hidden />
                Trocar usuário
              </button>
            )}
            <button type="button" className="app-layout__logout" onClick={() => void logout()}>
              <LogOut size={ICON_SIZE} strokeWidth={2} aria-hidden />
              Sair da loja
            </button>
          </div>
        </aside>

        <div className="app-layout__body">
          <header className="app-layout__header">
            {pinRequired && operator && (
              <span className="app-layout__operator">
                <UserRound size={16} strokeWidth={2} aria-hidden />
                {operator.displayName}
              </span>
            )}
            <ConnectionStatus />
          </header>
          <main className="app-layout__main">
            <PendingCheckoutBanner />
            <AccessNoticeBanner />
            <RequireBackOffice>
              <Outlet />
            </RequireBackOffice>
          </main>
        </div>

        {moreOpen && (
          <button
            type="button"
            className="app-layout__backdrop"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />
        )}

        <section className="app-layout__sheet" aria-hidden={!moreOpen}>
          <div className="app-layout__sheet-handle" />
          {organization && (
            <div className="app-layout__org">
              <strong>{organization.name}</strong>
              <span>Plano {planName}</span>
            </div>
          )}
          <nav className="app-layout__sheet-nav" aria-label="Mais opções">
            {moreNav.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'app-layout__link app-layout__link--active' : 'app-layout__link'
                  }
                >
                  <Icon size={ICON_SIZE} strokeWidth={2} aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="app-layout__footer">
            <span className="app-layout__user">
              {operator
                ? `${operator.displayName} · ${POS_ROLE_LABELS[operator.role]}`
                : (user?.displayName ?? user?.email)}
            </span>
            {pinRequired && (
              <button type="button" className="app-layout__logout" onClick={lock}>
                <UserRound size={ICON_SIZE} strokeWidth={2} aria-hidden />
                Trocar usuário
              </button>
            )}
            <button type="button" className="app-layout__logout" onClick={() => void logout()}>
              <LogOut size={ICON_SIZE} strokeWidth={2} aria-hidden />
              Sair da loja
            </button>
          </div>
        </section>

        <nav className="app-layout__bottom" aria-label="Atalhos">
          {primaryNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'app-layout__tab app-layout__tab--active' : 'app-layout__tab'
                }
              >
                <Icon size={TAB_ICON_SIZE} strokeWidth={2} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <button
            type="button"
            className={
              moreActive || moreOpen
                ? 'app-layout__tab app-layout__tab--active'
                : 'app-layout__tab'
            }
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreHorizontal size={TAB_ICON_SIZE} strokeWidth={2} aria-hidden />
            <span>Mais</span>
          </button>
        </nav>
    </div>
  )
}
