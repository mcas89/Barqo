import { useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  DEFAULT_PLAN_ID,
  ENTRADA_TRIAL_DAYS,
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_LIST,
  formatPlanPrice,
  getLimitValue,
  planHasFeature,
  type PlanId,
} from '../../billing'
import { validatePinFormat } from '../../users/services/pin'
import {
  APP_NAME,
  BALQO_LOGO_SRC,
  BUSINESS_SEGMENTS,
  DEFAULT_THEME_COLOR,
  THEME_PRESETS,
  normalizeBusinessSegment,
  resolveThemeTokens,
  themeCssVars,
} from '../../../shared/constants'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDocumentTheme } from '../../../shared/hooks/useDocumentTheme'
import { fileToLogoDataUrl } from '../../settings/lib/logo'
import { FiscalNotice, LegalAccept } from '../../legal'
import './OnboardingPage.css'

export function OnboardingPage() {
  const {
    isAuthenticated,
    organization,
    createOrganizationForCurrentUser,
    loading,
    error,
    clearError,
    firebaseReady,
    user,
  } = useAuth()
  const navigate = useNavigate()

  const [organizationName, setOrganizationName] = useState('')
  const [document, setDocument] = useState('')
  const [segment, setSegment] = useState<string>(BUSINESS_SEGMENTS[0])
  const [planId, setPlanId] = useState<PlanId>(DEFAULT_PLAN_ID)
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [ownerPin, setOwnerPin] = useState('')
  const [ownerPinConfirm, setOwnerPinConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useDocumentTheme(themeColor)
  const theme = resolveThemeTokens(themeColor)

  if (isAuthenticated && organization) {
    return <Navigate to="/app" replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace />
  }

  const selectedTheme =
    THEME_PRESETS.find((theme) => theme.color.toLowerCase() === themeColor.toLowerCase()) ?? null
  const shopName = organizationName.trim() || 'Sua loja'
  const needsOwnerPin = planHasFeature(planId, PLAN_FEATURES.MULTI_USER)
  const remainingSeats = Math.max(0, getLimitValue(planId, 'users') - 1)

  async function handleLogoChange(file: File | undefined) {
    if (!file) return
    setLocalError(null)
    if (file.type !== 'image/png') {
      setLocalError('Envie a logo em PNG com fundo transparente.')
      return
    }
    try {
      setLogoDataUrl(await fileToLogoDataUrl(file))
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao ler a logo.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    clearError()
    setLocalError(null)

    if (!firebaseReady) {
      setLocalError('Firebase não configurado.')
      return
    }

    if (!organizationName.trim()) {
      setLocalError('Informe o nome do comércio.')
      return
    }

    if (!acceptedTerms) {
      setLocalError('Aceite os Termos de uso e a Política de privacidade para criar a loja.')
      return
    }

    if (needsOwnerPin) {
      const pinError = validatePinFormat(ownerPin)
      if (pinError) {
        setLocalError(pinError)
        return
      }
      if (ownerPin !== ownerPinConfirm) {
        setLocalError('Os PINs do proprietário não conferem.')
        return
      }
    }

    try {
      const brand = {
        themeColor,
        logoDataUrl: logoDataUrl || undefined,
      }

      if (!user) {
        setLocalError('Faça login antes de cadastrar o comércio.')
        return
      }

      await createOrganizationForCurrentUser({
        organizationName,
        document,
        segment: normalizeBusinessSegment(segment),
        planId,
        ownerPin: needsOwnerPin ? ownerPin : undefined,
        ...brand,
      })
      navigate(planId === PLAN_IDS.ENTRADA ? '/app' : '/app/billing')
    } catch {
      // mensagem no AuthProvider
    }
  }

  return (
    <section
      className="onboarding-page"
      style={themeCssVars(themeColor) as CSSProperties}
    >
      <aside className="onboarding-page__preview-col">
        <div className="onboarding-page__preview-brand">
          <img src={BALQO_LOGO_SRC} alt={APP_NAME} />
        </div>
        <p className="onboarding-page__eyebrow">Prévia da loja</p>
        <div className="onboarding-page__chrome">
          <div className="onboarding-page__chrome-side">
            <div className="onboarding-page__chrome-logo">
              <img src={logoDataUrl || BALQO_LOGO_SRC} alt={APP_NAME} />
            </div>
            <strong>{shopName}</strong>
            <span>Plano {PLAN_LIST.find((plan) => plan.id === planId)?.name}</span>
            <nav>
              <em style={{ background: theme.brand }}>Início</em>
              <i>PDV</i>
              <i>Produtos</i>
              <i>Caixa</i>
            </nav>
          </div>
          <div className="onboarding-page__chrome-main">
            <b>Painel do dia</b>
            <small>Fundo e cor principal mudam juntos com o tema.</small>
            <div className="onboarding-page__chrome-cards">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <p className="onboarding-page__preview-note">
          Tema {selectedTheme?.name ?? 'personalizado'} ·{' '}
          {logoDataUrl ? 'logo da loja' : 'marca BALQO'}
        </p>
      </aside>

      <form className="onboarding-page__form" onSubmit={(event) => void handleSubmit(event)}>
        <header className="onboarding-page__header">
          <p className="onboarding-page__eyebrow">Cadastro da loja</p>
          <h1>Deixe o BALQO com a cara do seu comércio</h1>
          <p>
            Olá, {user?.displayName || user?.email}. Complete os dados do comércio para começar.
            O Solo tem {ENTRADA_TRIAL_DAYS} dias grátis.
          </p>
        </header>

        <section className="onboarding-page__block">
          <h2>Comércio</h2>
          <div className="onboarding-page__grid">
            <label className="onboarding-page__span">
              Nome do comércio
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={loading}
                required
                placeholder="Ex.: Boutique da Ana"
              />
            </label>
            <label>
              CPF/CNPJ (opcional)
              <input
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                disabled={loading}
              />
            </label>
            <label>
              Segmento
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                disabled={loading}
              >
                {BUSINESS_SEGMENTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="onboarding-page__block">
          <h2>Visual</h2>
          <p>A cor principal marca botões e o menu. O fundo do app fica numa versão mais clara do mesmo tema.</p>

          <div className="onboarding-page__themes">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={
                  themeColor.toLowerCase() === preset.color
                    ? 'onboarding-page__theme onboarding-page__theme--active'
                    : 'onboarding-page__theme'
                }
                onClick={() => setThemeColor(preset.color)}
                disabled={loading}
              >
                <i aria-hidden>
                  <b style={{ background: preset.color }} />
                  <b style={{ background: preset.bg }} />
                </i>
                {preset.name}
              </button>
            ))}
          </div>

          <label className="onboarding-page__logo-box">
            <img src={logoDataUrl || BALQO_LOGO_SRC} alt="" />
            <div>
              <strong>{logoDataUrl ? 'Logo selecionada' : 'Logo da loja (PNG)'}</strong>
              <em>Fundo transparente fica melhor. Se não enviar, usamos a marca BALQO.</em>
              <span>{logoDataUrl ? 'Trocar arquivo' : 'Escolher PNG'}</span>
            </div>
            <input
              type="file"
              accept="image/png"
              disabled={loading}
              onChange={(e) => void handleLogoChange(e.target.files?.[0])}
            />
          </label>
          {logoDataUrl && (
            <button
              type="button"
              className="onboarding-page__clear-logo"
              onClick={() => setLogoDataUrl(null)}
              disabled={loading}
            >
              Remover logo e usar BALQO
            </button>
          )}
        </section>

        <section className="onboarding-page__block">
          <h2>Plano</h2>
          <FiscalNotice />
          <div className="onboarding-page__plans">
            {PLAN_LIST.map((plan) => {
              const selected = planId === plan.id
              return (
                <label
                  key={plan.id}
                  className={
                    selected
                      ? 'onboarding-page__plan onboarding-page__plan--selected'
                      : 'onboarding-page__plan'
                  }
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={selected}
                    onChange={() => setPlanId(plan.id)}
                    disabled={loading}
                  />
                  <strong>{plan.name}</strong>
                  <b>{formatPlanPrice(plan.id)}</b>
                  <em>
                    {plan.id === PLAN_IDS.ENTRADA
                      ? `${ENTRADA_TRIAL_DAYS} dias grátis · ${plan.tagline}`
                      : plan.tagline}
                  </em>
                </label>
              )
            })}
          </div>
        </section>

        {needsOwnerPin && (
          <section className="onboarding-page__block">
            <h2>PIN do proprietário</h2>
            <p>
              O login da loja fica salvo neste aparelho. O PIN identifica quem está
              usando. Você cria o PIN do proprietário agora
              {remainingSeats > 0
                ? ` · restam ${remainingSeats} vaga${remainingSeats === 1 ? '' : 's'} para a equipe`
                : ''}
              .
            </p>
            <div className="onboarding-page__grid">
              <label>
                PIN (4 a 6 dígitos)
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  required
                  placeholder="••••"
                />
              </label>
              <label>
                Confirmar PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={ownerPinConfirm}
                  onChange={(e) =>
                    setOwnerPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  disabled={loading}
                  required
                  placeholder="••••"
                />
              </label>
            </div>
          </section>
        )}

        <LegalAccept
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          disabled={loading}
        />

        {(localError || error) && (
          <p className="onboarding-page__error" role="alert">
            {localError || error}
          </p>
        )}

        <button className="onboarding-page__submit" type="submit" disabled={loading}>
          {loading ? 'Criando loja…' : 'Criar loja e entrar'}
        </button>
      </form>
    </section>
  )
}
