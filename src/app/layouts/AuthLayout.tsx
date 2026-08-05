import { Outlet, Link, useLocation } from 'react-router-dom'
import { APP_NAME, BALQO_LOGO_SRC } from '../../shared/constants'
import './AuthLayout.css'

export function AuthLayout() {
  const { pathname } = useLocation()
  const isLogin = pathname === '/'
  const isOnboarding = pathname === '/onboarding'

  return (
    <div
      className={
        isLogin
          ? 'auth-layout auth-layout--login'
          : isOnboarding
            ? 'auth-layout auth-layout--onboarding'
            : 'auth-layout'
      }
    >
      {!isLogin && (
        <header className="auth-layout__brand">
          <Link to="/">
            <img src={BALQO_LOGO_SRC} alt={APP_NAME} />
          </Link>
        </header>
      )}
      <main className="auth-layout__main">
        <Outlet />
      </main>
    </div>
  )
}
