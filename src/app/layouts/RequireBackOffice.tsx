import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { BackOfficeElevateGate } from './BackOfficeElevateGate'

/** Bloqueia caixa/atendente no back-office, com elevação temporária via PIN. */
export function RequireBackOffice({ children }: { children: ReactNode }) {
  const location = useLocation()
  const {
    operator,
    canAccessBackOffice,
    loading,
    isElevatedFor,
    clearElevation,
    elevatedPath,
  } = usePosOperator()

  useEffect(() => {
    if (!elevatedPath) return
    if (isElevatedFor(location.pathname)) return
    clearElevation()
  }, [location.pathname, elevatedPath, isElevatedFor, clearElevation])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#5b6b80' }}>
        Carregando…
      </div>
    )
  }

  if (operator && !canAccessBackOffice && !isElevatedFor(location.pathname)) {
    return <BackOfficeElevateGate path={location.pathname} />
  }

  return children
}
