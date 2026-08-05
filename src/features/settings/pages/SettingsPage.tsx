import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  APP_NAME,
  APP_VERSION,
  BALQO_SUPPORT_WHATSAPP,
  BALQO_LOGO_SRC,
  DEFAULT_THEME_COLOR,
  resolveThemeColor,
  themeCssVars,
  THEME_PRESETS,
} from '../../../shared/constants'
import { requestPwaUpdateCheck } from '../../../shared/lib/pwa-updates'
import { formatWhatsappDisplay, whatsappUrl } from '../../../shared/lib/whatsapp'
import { getPlan } from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { POS_ROLE_LABELS } from '../../pos/types/operator'
import { useSettings } from '../hooks/useSettings'
import './SettingsPage.css'

const SEGMENTS = [
  'Mercearia / mercado',
  'Conveniência',
  'Vestuário',
  'Alimentação',
  'Pet shop',
  'Serviços',
  'Outro',
]

export function SettingsPage() {
  const { subscription } = useAuth()
  const { operators, pinRequired } = usePosOperator()
  const {
    devices,
    deviceId,
    maxDevices,
    removeDevice,
    refreshDevices,
  } = useDeviceSession()
  const {
    organization,
    user,
    canEdit,
    saving,
    error,
    message,
    clearFeedback,
    save,
    prepareLogo,
  } = useSettings()

  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [segment, setSegment] = useState(SEGMENTS[0])
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoDirty, setLogoDirty] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    const root = globalThis.document?.documentElement
    if (!root?.style || typeof themeCssVars !== 'function') return

    const preview = themeCssVars(themeColor)
    const restore = themeCssVars(organization?.themeColor)
    for (const [key, value] of Object.entries(preview)) {
      if (typeof value === 'string') root.style.setProperty(key, value)
    }
    return () => {
      for (const [key, value] of Object.entries(restore)) {
        if (typeof value === 'string') root.style.setProperty(key, value)
      }
    }
  }, [themeColor, organization?.themeColor])

  useEffect(() => {
    if (!organization) return
    setName(organization.name)
    setDocument(organization.document ?? '')
    setSegment(organization.segment || SEGMENTS[0])
    setPhone(organization.phone ?? '')
    setAddress(organization.address ?? '')
    setWhatsapp(organization.whatsapp ?? '')
    setThemeColor(resolveThemeColor(organization.themeColor))
    setLogoDataUrl(organization.logoDataUrl ?? null)
    setLogoDirty(false)
  }, [organization])

  const planName = subscription
    ? getPlan(subscription.planId).name
    : organization?.planId
      ? getPlan(organization.planId).name
      : '—'

  async function handleLogoChange(file: File | undefined) {
    if (!file) return
    clearFeedback()
    setLocalError(null)
    if (file.type !== 'image/png') {
      setLocalError('Envie a logo em PNG com fundo transparente.')
      return
    }
    try {
      const dataUrl = await prepareLogo(file)
      setLogoDataUrl(dataUrl)
      setLogoDirty(true)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao ler a logo.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    setLocalError(null)
    try {
      await save({
        name,
        document,
        segment,
        phone,
        address,
        whatsapp,
        themeColor,
        logoDataUrl: logoDirty ? logoDataUrl : undefined,
      })
      setLogoDirty(false)
    } catch {
      // feedback já vem do hook
    }
  }

  const selectedTheme =
    THEME_PRESETS.find((preset) => preset.color.toLowerCase() === themeColor.toLowerCase()) ?? null

  if (!organization) {
    return <p className="settings-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>Configurações</h1>
          <p>
            {organization.name} · Plano {planName} · {APP_NAME} {APP_VERSION}
          </p>
        </div>
      </header>

      <div className="settings-page__grid">
        <form className="settings-page__stack" onSubmit={(e) => void handleSubmit(e)}>
          <section className="settings-page__card">
            <h2>Dados do comércio</h2>
            <div className="settings-page__fields">
              <label className="settings-page__span">
                Nome
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving || !canEdit}
                  required
                />
              </label>
              <label>
                CPF/CNPJ
                <input
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  disabled={saving || !canEdit}
                />
              </label>
              <label>
                Segmento
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  disabled={saving || !canEdit}
                >
                  {SEGMENTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Telefone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving || !canEdit}
                />
              </label>
              <label>
                WhatsApp da loja
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  disabled={saving || !canEdit}
                  placeholder="5511999999999"
                />
              </label>
              <label className="settings-page__span">
                Endereço
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={saving || !canEdit}
                />
              </label>
            </div>
          </section>

          <section className="settings-page__card">
            <h2>Visual</h2>
            <p className="settings-page__hint">
              A cor principal marca botões e o menu. O fundo do app fica numa versão mais
              clara do mesmo tema
              {selectedTheme ? ` · ${selectedTheme.name}` : ''}.
            </p>

            <div className="settings-page__themes">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    themeColor.toLowerCase() === preset.color.toLowerCase()
                      ? 'settings-page__theme settings-page__theme--active'
                      : 'settings-page__theme'
                  }
                  onClick={() => setThemeColor(preset.color)}
                  disabled={saving || !canEdit}
                >
                  <i aria-hidden>
                    <b style={{ background: preset.color }} />
                    <b style={{ background: preset.bg }} />
                  </i>
                  {preset.name}
                </button>
              ))}
            </div>

            <label className="settings-page__logo-box">
              <img src={logoDataUrl || BALQO_LOGO_SRC} alt="" />
              <div>
                <strong>{logoDataUrl ? 'Logo selecionada' : 'Logo da loja (PNG)'}</strong>
                <em>Fundo transparente fica melhor. Se não enviar, usamos a marca BALQO.</em>
                <span>{logoDataUrl ? 'Trocar arquivo' : 'Escolher PNG'}</span>
              </div>
              <input
                type="file"
                accept="image/png"
                disabled={saving || !canEdit}
                onChange={(e) => void handleLogoChange(e.target.files?.[0])}
              />
            </label>
            {logoDataUrl && (
              <button
                type="button"
                className="settings-page__clear-logo"
                onClick={() => {
                  setLogoDataUrl(null)
                  setLogoDirty(true)
                }}
                disabled={saving || !canEdit}
              >
                Remover logo e usar BALQO
              </button>
            )}
          </section>

          {!canEdit && (
            <p className="settings-page__hint">Somente proprietário ou gerente pode editar.</p>
          )}

          {(localError || error) && (
            <p className="settings-page__error" role="alert">
              {localError || error}
            </p>
          )}
          {message && <p className="settings-page__ok">{message}</p>}

          <button className="settings-page__submit" type="submit" disabled={saving || !canEdit}>
            {saving ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </form>

        <aside className="settings-page__side">
          <div className="settings-page__card">
            <h2>Conta</h2>
            <p>
              <strong>{user?.displayName}</strong>
              <span>{user?.email}</span>
            </p>
            <Link to="/app/team">Gerenciar equipe e PIN</Link>
            <Link to="/app/billing#assinatura">Plano, comprovante e pagamentos</Link>
          </div>

          {pinRequired && (
            <div className="settings-page__card">
              <h2>PINs da loja</h2>
              <p>O proprietário entra pelo nome. Funcionários são cadastrados em Equipe.</p>
              <ul className="settings-page__pins">
                {operators.map((op) => (
                  <li key={op.id}>
                    <strong>{op.displayName}</strong>
                    <span>
                      {POS_ROLE_LABELS[op.role]}
                      {op.hasPin ? ' · PIN cadastrado' : ' · sem PIN'}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/app/team">Editar PINs na equipe</Link>
            </div>
          )}

          <div className="settings-page__card">
            <h2>Aparelhos</h2>
            <p>
              {devices.length}/{maxDevices} em uso. O mesmo usuário/PIN não entra em dois
              equipamentos.
            </p>
            <ul className="settings-page__pins">
              {devices.map((device) => (
                <li key={device.id}>
                  <strong>
                    {device.label}
                    {device.id === deviceId ? ' · este aparelho' : ''}
                  </strong>
                  <span>
                    {device.operatorName ? `${device.operatorName} · ` : ''}
                    visto {new Date(device.lastSeenAt).toLocaleString('pt-BR')}
                  </span>
                  {canEdit && device.id !== deviceId && (
                    <button
                      type="button"
                      className="settings-page__clear-logo"
                      onClick={() => void removeDevice(device.id)}
                    >
                      Remover aparelho
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="settings-page__clear-logo"
              onClick={() => void refreshDevices()}
            >
              Atualizar lista
            </button>
          </div>

          <div className="settings-page__card">
            <h2>Aplicativo</h2>
            <p>
              Versão {APP_VERSION}. As atualizações chegam neste aparelho sem desinstalar.
              Finalize a venda no PDV antes de aplicar.
            </p>
            <button
              type="button"
              className="settings-page__clear-logo"
              onClick={() => requestPwaUpdateCheck()}
            >
              Procurar atualização
            </button>
          </div>

          <div className="settings-page__card">
            <h2>Suporte BALQO</h2>
            <p>Dúvida de uso, cobrança ou implantação? Fale no WhatsApp.</p>
            <a
              className="settings-page__whatsapp"
              href={whatsappUrl(
                BALQO_SUPPORT_WHATSAPP,
                `Olá, sou ${user?.displayName || 'o proprietário'} da loja ${organization.name}. Preciso de suporte no BALQO.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp suporte
            </a>
            <span className="settings-page__hint">
              {formatWhatsappDisplay(BALQO_SUPPORT_WHATSAPP)}
            </span>
          </div>
        </aside>
      </div>
    </section>
  )
}
