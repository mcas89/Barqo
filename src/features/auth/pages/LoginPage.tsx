import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  UserRound,
} from 'lucide-react'
import { APP_NAME, APP_TAGLINE, BALQO_LOGO_SRC } from '../../../shared/constants'
import { useAuth } from '../../../shared/hooks/useAuth'
import { LegalAccept } from '../../legal'
import './LoginPage.css'

type AuthMode = 'login' | 'register' | 'reset'

export function LoginPage() {
  const {
    firebaseReady,
    login,
    registerAccount,
    requestPasswordReset,
    error,
    clearError,
    loading,
  } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    clearError()
    setLocalError(null)
    setShowPassword(false)
    setResetSent(false)
    setAcceptedTerms(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    clearError()
    setLocalError(null)

    if (!email.trim()) {
      setLocalError('Informe o e-mail.')
      return
    }

    if (mode === 'reset') {
      try {
        await requestPasswordReset(email)
        setResetSent(true)
      } catch {
        // erro já mapeado no AuthProvider
      }
      return
    }

    if (!password) {
      setLocalError('Informe e-mail e senha.')
      return
    }

    if (password.length < 6) {
      setLocalError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    try {
      if (mode === 'register') {
        if (!displayName.trim()) {
          setLocalError('Informe seu nome.')
          return
        }
        if (!acceptedTerms) {
          setLocalError('Aceite os Termos de uso e a Política de privacidade para continuar.')
          return
        }
        await registerAccount({ displayName, email, password })
        navigate('/onboarding')
        return
      }

      await login(email, password)
      navigate('/app')
    } catch {
      // erro já mapeado no AuthProvider
    }
  }

  const isLogin = mode === 'login'
  const isReset = mode === 'reset'

  return (
    <section className="login-page">
      <div className="login-page__panel">
        <img className="login-page__logo" src={BALQO_LOGO_SRC} alt={APP_NAME} />
        <h1>Seu comércio em um só lugar</h1>
        <p>{APP_TAGLINE}. PDV rápido, caixa organizado e controle do dia a dia.</p>
        <ul>
          <li>Vendas no balcão com PIN de operador</li>
          <li>Caixa, estoque e fiado sem complicação</li>
          <li>Comece no Entrada com 10 dias grátis e suba de plano quando quiser</li>
        </ul>
      </div>

      <div className="login-page__card">
        <header className="login-page__intro">
          <h2>
            {isReset ? 'Redefinir senha' : isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
          </h2>
          <p>
            {isReset
              ? 'Enviamos um link para o e-mail da conta do proprietário.'
              : isLogin
                ? 'Use o e-mail e a senha do proprietário do comércio.'
                : 'Depois do cadastro você informa os dados da loja.'}
          </p>
        </header>

        {!firebaseReady ? (
          <p className="login-page__setup">
            {import.meta.env.PROD ? (
              <>
                Firebase não entrou neste deploy. Na Vercel, em Settings → Environment
                Variables, cadastre as <code>VITE_FIREBASE_*</code> em Production e faça
                Redeploy com limpar cache.
              </>
            ) : (
              <>
                Firebase ainda sem chaves. Copie <code>.env.example</code> para{' '}
                <code>.env</code> e reinicie o servidor.
              </>
            )}
          </p>
        ) : (
          <form className="login-page__form" onSubmit={(event) => void handleSubmit(event)}>
            {!isLogin && !isReset && (
              <label>
                Seu nome
                <span className="login-page__field">
                  <UserRound className="login-page__field-icon" size={18} strokeWidth={2} aria-hidden />
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Nome e sobrenome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </span>
              </label>
            )}
            <label>
              E-mail
              <span className="login-page__field">
                <Mail className="login-page__field-icon" size={18} strokeWidth={2} aria-hidden />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </span>
            </label>
            {!isReset && (
              <label>
                Senha
                <span className="login-page__password">
                  <Lock className="login-page__field-icon" size={18} strokeWidth={2} aria-hidden />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder={isLogin ? 'Sua senha' : 'Mínimo 6 caracteres'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="login-page__toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={2} aria-hidden />
                    ) : (
                      <Eye size={18} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </span>
              </label>
            )}

            {isLogin && (
              <button
                type="button"
                className="login-page__forgot"
                onClick={() => switchMode('reset')}
                disabled={loading}
              >
                <KeyRound size={14} strokeWidth={2} aria-hidden />
                Esqueci a senha
              </button>
            )}

            {!isLogin && !isReset && (
              <LegalAccept
                checked={acceptedTerms}
                onChange={setAcceptedTerms}
                disabled={loading}
              />
            )}

            {(localError || error) && (
              <p className="login-page__error" role="alert">
                {localError || error}
              </p>
            )}

            {resetSent && (
              <p className="login-page__ok" role="status">
                Se o e-mail estiver cadastrado, o link de redefinição já foi enviado. Confira a
                caixa de entrada e o spam.
              </p>
            )}

            <button className="login-page__cta" type="submit" disabled={loading}>
              <span>
                {loading
                  ? isReset
                    ? 'Enviando…'
                    : isLogin
                      ? 'Entrando…'
                      : 'Criando conta…'
                  : isReset
                    ? 'Enviar link'
                    : isLogin
                      ? 'Entrar'
                      : 'Continuar cadastro'}
              </span>
              {!loading && <ArrowRight size={18} strokeWidth={2.25} aria-hidden />}
            </button>
          </form>
        )}

        <p className="login-page__switch">
          {isReset ? (
            <>
              Lembrou a senha?{' '}
              <button type="button" onClick={() => switchMode('login')} disabled={loading}>
                Entrar
              </button>
            </>
          ) : isLogin ? (
            <>
              Não tenho cadastro.{' '}
              <button type="button" onClick={() => switchMode('register')} disabled={loading}>
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" onClick={() => switchMode('login')} disabled={loading}>
                Entrar
              </button>
            </>
          )}
        </p>

        <Link className="login-page__footer-link" to="/onboarding">
          Conta criada e falta cadastrar o comércio
        </Link>
        <p className="login-page__legal">
          <Link to="/termos">Termos</Link>
          {' · '}
          <Link to="/privacidade">Privacidade</Link>
        </p>
      </div>
    </section>
  )
}
