import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'

/** Redireciona quem já está logado com comércio para o app. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, organization, loading, firebaseReady } = useAuth()

  if (firebaseReady && loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#5b6b80' }}>
        Carregando…
      </div>
    )
  }

  if (isAuthenticated && organization) {
    return <Navigate to="/app" replace />
  }

  if (isAuthenticated && !organization) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
