import { Outlet, Link, useLocation } from 'react-router-dom'
import { APP_NAME, BALQO_LOGO_SRC } from '../../shared/constants'
import './AuthLayout.css'

export function AuthLayout() {
  const { pathname } = useLocation()
  const isLogin = pathname === '/'
  const isOnboarding = pathname === '/onboarding'
  const isLegal = pathname === '/termos' || pathname === '/privacidade'

  return (
    <div
      className={
        isLogin
          ? 'auth-layout auth-layout--login'
          : isOnboarding
            ? 'auth-layout auth-layout--onboarding'
            : isLegal
              ? 'auth-layout auth-layout--legal'
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
