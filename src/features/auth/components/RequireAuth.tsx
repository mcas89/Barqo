import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, firebaseReady, organization } = useAuth()
  const location = useLocation()

  if (!firebaseReady) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#5b6b80' }}>
        Carregando sessão…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (!organization && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
