import { useEffect, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { themeCssVars } from '../../shared/constants'
import { BrandMark } from '../../shared/components/BrandMark'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDocumentTheme } from '../../shared/hooks/useDocumentTheme'
import { getPlan } from '../../features/billing'
import { PendingCheckoutBanner } from '../../features/billing/components/PendingCheckoutBanner'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { POS_ROLE_LABELS } from '../../features/pos/types/operator'
import { RequireBackOffice } from './RequireBackOffice'
import './AppLayout.css'

const NAV = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/pos', label: 'PDV' },
  { to: '/app/products', label: 'Produtos' },
  { to: '/app/customers', label: 'Clientes' },
  { to: '/app/receivables', label: 'Fiado' },
  { to: '/app/cash', label: 'Caixa' },
  { to: '/app/team', label: 'Equipe' },
  { to: '/app/inventory', label: 'Estoque' },
  { to: '/app/suppliers', label: 'Fornecedores' },
  { to: '/app/reports', label: 'Relatórios' },
  { to: '/app/billing', label: 'Planos' },
  { to: '/app/settings', label: 'Config' },
]

const PRIMARY_NAV = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/pos', label: 'PDV' },
  { to: '/app/products', label: 'Produtos' },
  { to: '/app/cash', label: 'Caixa' },
]

const MORE_NAV = NAV.filter((item) => !PRIMARY_NAV.some((primary) => primary.to === item.to))

function pathMatches(pathname: string, to: string, end?: boolean) {
  if (end || to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppLayout() {
  const { user, organization, subscription, logout } = useAuth()
  const { operator, pinRequired, lock } = usePosOperator()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
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

  const moreActive = MORE_NAV.some((item) => pathMatches(location.pathname, item.to, item.end))

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
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'app-layout__link app-layout__link--active' : 'app-layout__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-layout__footer">
            <span className="app-layout__user">
              {operator
                ? `${operator.displayName} · ${POS_ROLE_LABELS[operator.role]}`
                : (user?.displayName ?? user?.email)}
            </span>
            {pinRequired && (
              <button type="button" className="app-layout__logout" onClick={lock}>
                Trocar usuário
              </button>
            )}
            <button type="button" className="app-layout__logout" onClick={() => void logout()}>
              Sair da loja
            </button>
          </div>
        </aside>

        <div className="app-layout__body">
          <header className="app-layout__header">
            {pinRequired && operator && (
              <span className="app-layout__operator">{operator.displayName}</span>
            )}
            <ConnectionStatus />
          </header>
          <main className="app-layout__main">
            <PendingCheckoutBanner />
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
            {MORE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'app-layout__link app-layout__link--active' : 'app-layout__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-layout__footer">
            <span className="app-layout__user">
              {operator
                ? `${operator.displayName} · ${POS_ROLE_LABELS[operator.role]}`
                : (user?.displayName ?? user?.email)}
            </span>
            {pinRequired && (
              <button type="button" className="app-layout__logout" onClick={lock}>
                Trocar usuário
              </button>
            )}
            <button type="button" className="app-layout__logout" onClick={() => void logout()}>
              Sair da loja
            </button>
          </div>
        </section>

        <nav className="app-layout__bottom" aria-label="Atalhos">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'app-layout__tab app-layout__tab--active' : 'app-layout__tab'
              }
            >
              {item.label}
            </NavLink>
          ))}
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
            Mais
          </button>
        </nav>
    </div>
  )
}
