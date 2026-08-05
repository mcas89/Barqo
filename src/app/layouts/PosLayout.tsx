import { useEffect, useState, type CSSProperties } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { themeCssVars } from '../../shared/constants'
import { BrandMark } from '../../shared/components/BrandMark'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDocumentTheme } from '../../shared/hooks/useDocumentTheme'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { POS_ROLE_LABELS } from '../../features/pos/types/operator'
import { AccessNoticeBanner } from '../../features/devices'
import './PosLayout.css'

function formatLiveClock(date: Date) {
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function PosLayout() {
  const { organization } = useAuth()
  const { operator, lock, pinRequired } = usePosOperator()
  const [now, setNow] = useState(() => new Date())
  useDocumentTheme(organization?.themeColor)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="pos-layout" style={themeCssVars(organization?.themeColor) as CSSProperties}>
      <aside className="pos-layout__logo">
        <BrandMark organization={organization} />
      </aside>

      <header className="pos-layout__bar">
        <div className="pos-layout__actions">
          <Link to="/app" className="pos-layout__back">
            Menu
          </Link>
          {pinRequired && operator && (
            <button type="button" className="pos-layout__back" onClick={lock}>
              Trocar operador
            </button>
          )}
          {operator && (
            <div className="pos-layout__who">
              <strong>{operator.displayName}</strong>
              <span>{POS_ROLE_LABELS[operator.role]}</span>
            </div>
          )}
        </div>
        <div className="pos-layout__meta">
          <time className="pos-layout__clock" dateTime={now.toISOString()}>
            {formatLiveClock(now)}
          </time>
          <ConnectionStatus />
        </div>
      </header>

      <main className="pos-layout__main">
        <AccessNoticeBanner />
        <Outlet />
      </main>
    </div>
  )
}
