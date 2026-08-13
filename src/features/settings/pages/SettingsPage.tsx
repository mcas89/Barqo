import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  APP_NAME,
  APP_VERSION,
  BALQO_SUPPORT_WHATSAPP,
  BALQO_LOGO_SRC,
  BUSINESS_SEGMENTS,
  DEFAULT_THEME_COLOR,
  normalizeBusinessSegment,
  isKnownBusinessSegment,
  resolveThemeColor,
  themeCssVars,
  THEME_PRESETS,
} from '../../../shared/constants'
import { requestPwaUpdateCheck } from '../../../shared/lib/pwa-updates'
import { formatWhatsappDisplay, whatsappUrl } from '../../../shared/lib/whatsapp'
import { getPlan } from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { updateThisDevicePrinterPath, useDeviceSession, DEVICE_STATUS_LABELS } from '../../devices'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { POS_ROLE_LABELS } from '../../pos/types/operator'
import {
  flushReceiptOutbox,
  normalizePaperWidth,
  printSampleReceipt,
  resolveReceiptSettings,
  writeLocalPrinterPath,
  type ReceiptPaperWidth,
} from '../../receipts'
import {
  PrinterSettingsModal,
  type PrinterSettingsValue,
} from '../components/PrinterSettingsModal'
import {
  WhatsappReceiptSettingsModal,
  type WhatsappReceiptSettingsValue,
} from '../components/WhatsappReceiptSettingsModal'
import { CategoriesSettingsModal } from '../components/CategoriesSettingsModal'
import { useSettings } from '../hooks/useSettings'
import './SettingsPage.css'

const SETTINGS_SECTIONS = [
  { id: 'loja', label: 'Loja' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'acesso', label: 'Acesso' },
  { id: 'app', label: 'App e ajuda' },
] as const

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

function parseSettingsSection(hash: string): SettingsSectionId {
  const id = hash.replace(/^#/, '').trim().toLowerCase()
  if (SETTINGS_SECTIONS.some((section) => section.id === id)) {
    return id as SettingsSectionId
  }
  // Atalhos antigos / deep links
  if (id === 'dispositivos' || id === 'pins' || id === 'conta') return 'acesso'
  if (id === 'impressora' || id === 'whatsapp' || id === 'categorias') return 'vendas'
  if (id === 'visual') return 'aparencia'
  return 'loja'
}

export function SettingsPage() {
  const { subscription } = useAuth()
  const { operators, pinRequired, hasPrivilegedAccess } = usePosOperator()
  const {
    devices,
    deviceId,
    maxDevices,
    removeDevice,
    blockDevice,
    authorizeDevice,
    renameDevice,
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

  const [section, setSection] = useState<SettingsSectionId>(() =>
    parseSettingsSection(
      typeof window !== 'undefined' ? window.location.hash : '',
    ),
  )
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [segment, setSegment] = useState<string>(BUSINESS_SEGMENTS[0])
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoDirty, setLogoDirty] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [printOnSale, setPrintOnSale] = useState(false)
  const [sendReceiptOnSale, setSendReceiptOnSale] = useState(false)
  const [printerPath, setPrinterPath] = useState('')
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('58mm')
  const [testingPrint, setTestingPrint] = useState(false)
  const [printerModalOpen, setPrinterModalOpen] = useState(false)
  const [whatsappReceiptOnSale, setWhatsappReceiptOnSale] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)

  useEffect(() => {
    function onHashChange() {
      setSection(parseSettingsSection(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function goToSection(next: SettingsSectionId) {
    setSection(next)
    const url = `${window.location.pathname}${window.location.search}#${next}`
    window.history.replaceState(null, '', url)
  }

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
    setSegment(normalizeBusinessSegment(organization.segment))
    setPhone(organization.phone ?? '')
    setAddress(organization.address ?? '')
    setWhatsapp(organization.whatsapp ?? '')
    setThemeColor(resolveThemeColor(organization.themeColor))
    setLogoDataUrl(organization.logoDataUrl ?? null)
    setLogoDirty(false)
    setPrintOnSale(Boolean(organization.printReceiptOnSale))
    setSendReceiptOnSale(Boolean(organization.sendReceiptOnSale))
    setWhatsappReceiptOnSale(Boolean(organization.offerWhatsappReceiptOnSale))
    setPaperWidth(normalizePaperWidth(organization.receiptPaperWidth))
  }, [organization])

  useEffect(() => {
    const devicePath = devices.find((device) => device.id === deviceId)?.printerPath
    setPrinterPath(devicePath?.trim() || organization?.printerPath?.trim() || '')
  }, [devices, deviceId, organization?.printerPath])

  useEffect(() => {
    void flushReceiptOutbox()
  }, [])

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
        segment: normalizeBusinessSegment(segment),
        phone,
        address,
        whatsapp,
        themeColor,
        logoDataUrl: logoDirty ? logoDataUrl : undefined,
        printReceiptOnSale: printOnSale,
        sendReceiptOnSale: false,
        offerWhatsappReceiptOnSale: whatsappReceiptOnSale,
        receiptPaperWidth: paperWidth,
        printerPath,
      })
      writeLocalPrinterPath(printerPath)
      if (organization) {
        await updateThisDevicePrinterPath(organization.id, printerPath).catch(() => undefined)
        await refreshDevices().catch(() => undefined)
      }
      setLogoDirty(false)
    } catch {
      // feedback já vem do hook
    }
  }

  async function handleTestPrint(override?: PrinterSettingsValue) {
    if (!organization) return
    const next = override ?? {
      printOnSale,
      sendReceiptOnSale,
      printerPath,
      paperWidth,
    }
    setTestingPrint(true)
    setLocalError(null)
    try {
      const settings = resolveReceiptSettings({
        organization: {
          ...organization,
          printReceiptOnSale: next.printOnSale,
          sendReceiptOnSale: next.sendReceiptOnSale,
          receiptPaperWidth: next.paperWidth,
          printerPath: next.printerPath,
        },
        devicePrinterPath: next.printerPath,
      })
      const result = await printSampleReceipt({
        organizationName: name || organization.name,
        settings: {
          ...settings,
          printOnSale: true,
          printerPath: next.printerPath,
          paperWidth: next.paperWidth,
        },
        logoDataUrl: logoDataUrl ?? undefined,
      })
      if (result.status === 'failed') {
        throw new Error(result.message || 'Não foi possível testar a impressora.')
      }
    } finally {
      setTestingPrint(false)
    }
  }

  async function handleSavePrinter(value: PrinterSettingsValue) {
    clearFeedback()
    setLocalError(null)
    setPrintOnSale(value.printOnSale)
    setSendReceiptOnSale(value.sendReceiptOnSale)
    setPrinterPath(value.printerPath)
    setPaperWidth(value.paperWidth)
    await save({
      name,
      document,
        segment: normalizeBusinessSegment(segment),
        phone,
      address,
      whatsapp,
      themeColor,
      logoDataUrl: logoDirty ? logoDataUrl : undefined,
      printReceiptOnSale: value.printOnSale,
      sendReceiptOnSale: false,
      offerWhatsappReceiptOnSale: whatsappReceiptOnSale,
      receiptPaperWidth: value.paperWidth,
      printerPath: value.printerPath,
    })
    writeLocalPrinterPath(value.printerPath)
    if (organization) {
      await updateThisDevicePrinterPath(organization.id, value.printerPath).catch(() => undefined)
      await refreshDevices().catch(() => undefined)
    }
    setLogoDirty(false)
  }

  async function handleSaveWhatsapp(value: WhatsappReceiptSettingsValue) {
    clearFeedback()
    setLocalError(null)
    setWhatsappReceiptOnSale(value.offerWhatsappReceiptOnSale)
    await save({
      name,
      document,
        segment: normalizeBusinessSegment(segment),
        phone,
      address,
      whatsapp,
      themeColor,
      logoDataUrl: logoDirty ? logoDataUrl : undefined,
      printReceiptOnSale: printOnSale,
      sendReceiptOnSale: false,
      offerWhatsappReceiptOnSale: value.offerWhatsappReceiptOnSale,
      receiptPaperWidth: paperWidth,
      printerPath,
    })
    setLogoDirty(false)
  }

  const selectedTheme =
    THEME_PRESETS.find((preset) => preset.color.toLowerCase() === themeColor.toLowerCase()) ?? null

  const activeDeviceCount = devices.filter((d) => d.status !== 'removed').length
  const showSaveFeedback = section === 'loja' || section === 'aparencia'

  if (!organization) {
    return <p className="settings-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="settings-page">
      {printerModalOpen && (
        <PrinterSettingsModal
          initial={{
            printOnSale,
            sendReceiptOnSale,
            printerPath,
            paperWidth,
          }}
          canEdit={canEdit}
          saving={saving}
          testingPrint={testingPrint}
          onClose={() => setPrinterModalOpen(false)}
          onSave={handleSavePrinter}
          onTestPrint={handleTestPrint}
        />
      )}
      {whatsappModalOpen && (
        <WhatsappReceiptSettingsModal
          initial={{ offerWhatsappReceiptOnSale: whatsappReceiptOnSale }}
          canEdit={canEdit}
          saving={saving}
          storeWhatsapp={whatsapp}
          onClose={() => setWhatsappModalOpen(false)}
          onSave={async (value) => {
            await handleSaveWhatsapp(value)
            setWhatsappModalOpen(false)
          }}
        />
      )}
      {categoriesModalOpen && (
        <CategoriesSettingsModal
          canEdit={canEdit}
          onClose={() => setCategoriesModalOpen(false)}
        />
      )}

      <header className="settings-page__header">
        <div>
          <h1>Configurações</h1>
          <p>
            {organization.name} · Plano {planName} · {APP_NAME} {APP_VERSION}
          </p>
        </div>
      </header>

      <nav className="settings-page__nav" aria-label="Seções de configuração">
        {SETTINGS_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              section === item.id
                ? 'settings-page__nav-btn settings-page__nav-btn--active'
                : 'settings-page__nav-btn'
            }
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => goToSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="settings-page__panel">
        {section === 'loja' && (
          <form className="settings-page__stack" onSubmit={(e) => void handleSubmit(e)}>
            <section className="settings-page__card">
              <h2>Dados do comércio</h2>
              <p className="settings-page__hint">
                Informações usadas em orçamentos, cupons e identificação da loja.
              </p>
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
                    {BUSINESS_SEGMENTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    {segment && !isKnownBusinessSegment(segment) && (
                      <option value={segment}>{segment}</option>
                    )}
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

            {!canEdit && (
              <p className="settings-page__hint">Somente proprietário ou gerente pode editar.</p>
            )}
            {(localError || error) && showSaveFeedback && (
              <p className="settings-page__error" role="alert">
                {localError || error}
              </p>
            )}
            {message && showSaveFeedback && <p className="settings-page__ok">{message}</p>}
            <button className="settings-page__submit" type="submit" disabled={saving || !canEdit}>
              {saving ? 'Salvando…' : 'Salvar dados da loja'}
            </button>
          </form>
        )}

        {section === 'aparencia' && (
          <form className="settings-page__stack" onSubmit={(e) => void handleSubmit(e)}>
            <section className="settings-page__card">
              <h2>Visual da loja</h2>
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
            {(localError || error) && showSaveFeedback && (
              <p className="settings-page__error" role="alert">
                {localError || error}
              </p>
            )}
            {message && showSaveFeedback && <p className="settings-page__ok">{message}</p>}
            <button className="settings-page__submit" type="submit" disabled={saving || !canEdit}>
              {saving ? 'Salvando…' : 'Salvar aparência'}
            </button>
          </form>
        )}

        {section === 'vendas' && (
          <div className="settings-page__stack">
            <section className="settings-page__card">
              <h2>Impressora e comprovante</h2>
              <p className="settings-page__hint">
                {printOnSale
                  ? `Cupom ao vender ligado${printerPath ? ` · ${printerPath}` : ' · janela do Windows'}`
                  : 'Cupom ao vender desligado'}
                {' · '}
                {paperWidth}
              </p>
              <button
                type="button"
                className="settings-page__printer-btn"
                onClick={() => setPrinterModalOpen(true)}
                disabled={!canEdit}
              >
                Configurar impressora
              </button>
            </section>

            <section className="settings-page__card">
              <h2>Comprovante WhatsApp</h2>
              <p className="settings-page__hint">
                {whatsappReceiptOnSale
                  ? 'Após a venda, oferece opção de abrir o WhatsApp com o cupom pronto'
                  : 'Oferta de WhatsApp após a venda desligada'}
              </p>
              <button
                type="button"
                className="settings-page__printer-btn"
                onClick={() => setWhatsappModalOpen(true)}
                disabled={!canEdit}
              >
                Configurar WhatsApp
              </button>
            </section>

            <section className="settings-page__card">
              <h2>Categorias de produtos</h2>
              <p className="settings-page__hint">
                Organize o catálogo. No cadastro do produto a categoria é opcional e só por
                seleção.
              </p>
              <button
                type="button"
                className="settings-page__printer-btn"
                onClick={() => setCategoriesModalOpen(true)}
                disabled={!canEdit}
              >
                Gerenciar categorias
              </button>
            </section>

            {!canEdit && (
              <p className="settings-page__hint">Somente proprietário ou gerente pode editar.</p>
            )}
          </div>
        )}

        {section === 'acesso' && (
          <div className="settings-page__stack">
            <section className="settings-page__card settings-page__card--meta">
              <h2>Conta</h2>
              <p>
                <strong>{user?.displayName}</strong>
                <span>{user?.email}</span>
              </p>
              <div className="settings-page__link-row">
                <Link to="/app/team">Gerenciar equipe e PIN</Link>
                <Link to="/app/billing#assinatura">Plano, comprovante e pagamentos</Link>
              </div>
            </section>

            {pinRequired && (
              <section className="settings-page__card settings-page__card--meta">
                <h2>PINs da loja</h2>
                <p>
                  O proprietário entra pelo nome. Funcionários são cadastrados em Equipe.
                </p>
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
              </section>
            )}

            <section className="settings-page__card settings-page__card--meta">
              <h2>Dispositivos autorizados</h2>
              <p>
                {activeDeviceCount}/{maxDevices} em uso. Lease de 24h · limite offline 72h.
                Bloquear nunca apaga a fila de sync.
              </p>
              <ul className="settings-page__pins">
                {devices.map((device) => {
                  const isThis = device.id === deviceId
                  const statusLabel = DEVICE_STATUS_LABELS[device.status] ?? device.status
                  return (
                    <li key={device.id}>
                      <strong>
                        {device.label}
                        {isThis ? ' · este aparelho' : ''}
                      </strong>
                      <span>
                        {statusLabel}
                        {device.operatorName ? ` · ${device.operatorName}` : ''}
                        {' · '}
                        visto {new Date(device.lastSeenAt).toLocaleString('pt-BR')}
                      </span>
                      {hasPrivilegedAccess && (
                        <div className="settings-page__device-actions">
                          <button
                            type="button"
                            className="settings-page__clear-logo"
                            onClick={() => {
                              const next = window.prompt('Nome do aparelho', device.label)
                              if (next == null) return
                              void renameDevice(device.id, next).catch((err) =>
                                window.alert(
                                  err instanceof Error ? err.message : 'Falha ao renomear.',
                                ),
                              )
                            }}
                          >
                            Renomear
                          </button>
                          {device.status === 'authorized' && !isThis ? (
                            <button
                              type="button"
                              className="settings-page__clear-logo"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    'Bloquear este aparelho? Ele não poderá vender ao reconectar. A fila local é preservada.',
                                  )
                                ) {
                                  return
                                }
                                void blockDevice(device.id)
                              }}
                            >
                              Bloquear
                            </button>
                          ) : null}
                          {(device.status === 'blocked' || device.status === 'removed') && (
                            <button
                              type="button"
                              className="settings-page__clear-logo"
                              onClick={() => void authorizeDevice(device.id)}
                            >
                              Reautorizar
                            </button>
                          )}
                          {device.status !== 'removed' && !isThis ? (
                            <button
                              type="button"
                              className="settings-page__clear-logo"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    'Remover autorização deste aparelho? A fila de sync local não será apagada.',
                                  )
                                ) {
                                  return
                                }
                                void removeDevice(device.id)
                              }}
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                className="settings-page__clear-logo"
                onClick={() => void refreshDevices()}
              >
                Atualizar lista
              </button>
              {!hasPrivilegedAccess && (
                <p className="settings-page__hint">
                  Somente dono ou gerente pode bloquear ou reautorizar aparelhos.
                </p>
              )}
            </section>
          </div>
        )}

        {section === 'app' && (
          <div className="settings-page__stack">
            <section className="settings-page__card settings-page__card--meta">
              <h2>Aplicativo</h2>
              <p>
                Versão {APP_VERSION}. As atualizações chegam neste aparelho sem desinstalar.
                Finalize a venda no PDV antes de aplicar.
              </p>
              <button
                type="button"
                className="settings-page__printer-btn"
                onClick={() => requestPwaUpdateCheck()}
              >
                Procurar atualização
              </button>
            </section>

            <section className="settings-page__card settings-page__card--meta">
              <h2>Termos e privacidade</h2>
              <p>O BALQO não emite NF-e. O cupom é comprovante interno da loja.</p>
              <div className="settings-page__legal-links">
                <Link to="/termos">Termos de uso</Link>
                <Link to="/privacidade">Política de privacidade</Link>
              </div>
            </section>

            <section className="settings-page__card settings-page__card--meta">
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
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
