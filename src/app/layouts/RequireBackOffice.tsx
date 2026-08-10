import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import { permissionForPath } from '../../features/users/permissions'
import { BackOfficeElevateGate } from './BackOfficeElevateGate'

/** Bloqueia quem não tem permissão no back-office, com elevação temporária via PIN. */
export function RequireBackOffice({ children }: { children: ReactNode }) {
  const location = useLocation()
  const {
    operator,
    can,
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

  const needed = permissionForPath(location.pathname)
  // Respeita permissões finas por página. Não usar canAccessBackOffice como
  // “libera tudo” — senão os checkboxes da Equipe não têm efeito.
  const allowed =
    needed === null ||
    (needed ? can(needed) : false) ||
    isElevatedFor(location.pathname)

  if (operator && !allowed) {
    return <BackOfficeElevateGate path={location.pathname} />
  }

  return children
}
