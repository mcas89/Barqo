import { useEffect, useState } from 'react'
import {
  BROWSER_PRINT_VALUE,
  listSystemPrinters,
  QZ_DOWNLOAD_URL,
  QZ_INSTALL_GUIDE_URL,
  QZ_OVERRIDE_URL,
  type SystemPrinter,
} from '../../receipts/qz-client'
import {
  normalizePaperWidth,
  type ReceiptPaperWidth,
} from '../../receipts'
import './PrinterSettingsModal.css'

export interface PrinterSettingsValue {
  printOnSale: boolean
  sendReceiptOnSale: boolean
  printerPath: string
  paperWidth: ReceiptPaperWidth
}

export function PrinterSettingsModal({
  initial,
  canEdit,
  saving,
  testingPrint,
  onClose,
  onSave,
  onTestPrint,
}: {
  initial: PrinterSettingsValue
  canEdit: boolean
  saving?: boolean
  testingPrint?: boolean
  onClose: () => void
  onSave: (value: PrinterSettingsValue) => Promise<void>
  onTestPrint: (value: PrinterSettingsValue) => Promise<void>
}) {
  const [printOnSale, setPrintOnSale] = useState(initial.printOnSale)
  const [printerPath, setPrinterPath] = useState(initial.printerPath)
  const [paperWidth, setPaperWidth] = useState(initial.paperWidth)
  const [printers, setPrinters] = useState<SystemPrinter[]>([])
  const [qzOnline, setQzOnline] = useState(false)
  const [checking, setChecking] = useState(true)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localOk, setLocalOk] = useState<string | null>(null)

  const value: PrinterSettingsValue = {
    printOnSale,
    sendReceiptOnSale: false,
    printerPath,
    paperWidth,
  }

  async function refreshQz() {
    setChecking(true)
    setLocalError(null)
    try {
      const listed = await listSystemPrinters()
      setQzOnline(listed.agentOnline)
      setPrinters(listed.printers)
      if (listed.agentOnline && !printerPath.trim() && listed.printers[0]) {
        setPrinterPath(listed.printers[0].name)
      }
      if (listed.agentOnline) {
        setLocalOk('QZ Tray conectado. Escolha a impressora e teste.')
        setStepsOpen(false)
      }
    } catch (err) {
      setQzOnline(false)
      setPrinters([])
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Não foi possível falar com o QZ Tray. Confira se ele está aberto.',
      )
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    void refreshQz()
  }, [])

  async function handleSave() {
    setLocalError(null)
    setLocalOk(null)
    try {
      await onSave(value)
      setLocalOk('Configuração da impressora salva.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  async function handleTest() {
    setLocalError(null)
    setLocalOk(null)
    try {
      await onTestPrint(value)
      setLocalOk('Teste enviado. Confira a impressora.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao testar a impressora.')
    }
  }

  const selectValue = printers.some((printer) => printer.name === printerPath)
    ? printerPath
    : printerPath.trim()
      ? printerPath
      : ''

  return (
    <div className="printer-modal">
      <button
        type="button"
        className="printer-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="printer-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="printer-modal-title"
      >
        <header>
          <h2 id="printer-modal-title">Configurar impressora</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div
          className={
            qzOnline
              ? 'printer-modal__status printer-modal__status--ok'
              : 'printer-modal__status printer-modal__status--off'
          }
        >
          <strong>
            {checking
              ? 'Verificando QZ Tray…'
              : qzOnline
                ? 'QZ Tray conectado'
                : 'QZ Tray não detectado'}
          </strong>
          <span>
            {qzOnline
              ? 'Impressão silenciosa pronta neste PC.'
              : 'Instale o QZ Tray e o certificado BALQO (passos abaixo).'}
          </span>
          <button type="button" onClick={() => void refreshQz()} disabled={checking}>
            {checking ? 'Verificando…' : 'Verificar conexão'}
          </button>
        </div>

        <section className="printer-modal__block">
          <button
            type="button"
            className="printer-modal__steps-toggle"
            aria-expanded={stepsOpen}
            onClick={() => setStepsOpen((open) => !open)}
          >
            <h3>Como instalar (loja / técnico)</h3>
            <span>{stepsOpen ? 'Ocultar' : 'Mostrar'}</span>
          </button>

          {stepsOpen && (
            <>
              <ol className="printer-modal__steps">
                <li>
                  <strong>Baixe o QZ Tray</strong> no site oficial (
                  <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    qz.io/download
                  </a>
                  ) — use o arquivo <strong>.exe</strong>, não o comando PowerShell.
                </li>
                <li>
                  Instale e deixe o QZ aberto (ícone perto do relógio do Windows).
                </li>
                <li>
                  Clique em <strong>Baixar certificado BALQO</strong> abaixo
                  (arquivo <code>override.crt</code>).
                </li>
                <li>
                  Abra a pasta do QZ Tray (em geral{' '}
                  <code>C:\Program Files\QZ Tray\</code>
                  ). Dica: botão direito no ícone do QZ → Advanced → Open File Location.
                </li>
                <li>
                  Cole o <code>override.crt</code> nessa pasta (substitua se já existir um
                  antigo). Aceite a permissão de administrador se o Windows pedir.
                </li>
                <li>
                  Feche o QZ por completo (Exit) e abra de novo.
                </li>
                <li>
                  Volte aqui → <strong>Verificar conexão</strong> → escolha a impressora →
                  <strong>Testar impressão</strong> → Salvar.
                </li>
              </ol>

              <p className="printer-modal__cert-note">
                O certificado BALQO é a “chave de confiança” da loja. Sem ele, o QZ pode
                pedir autorização a cada cupom. Com ele instalado uma vez, a impressão fica
                silenciosa.
              </p>

              <div className="printer-modal__downloads">
                <a
                  className="printer-modal__primary printer-modal__primary-link"
                  href={QZ_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  1. Baixar QZ Tray
                </a>
                <a
                  className="printer-modal__primary printer-modal__primary-link"
                  href={QZ_OVERRIDE_URL}
                  download="override.crt"
                >
                  2. Baixar certificado BALQO
                </a>
                <a
                  className="printer-modal__ghost-link"
                  href={QZ_INSTALL_GUIDE_URL}
                  download
                >
                  Guia completo (.txt)
                </a>
              </div>
            </>
          )}
        </section>

        <section className="printer-modal__block">
          <h3>Opções do cupom</h3>
          <label className="printer-modal__switch">
            <input
              type="checkbox"
              checked={printOnSale}
              onChange={(event) => setPrintOnSale(event.target.checked)}
              disabled={!canEdit || saving}
            />
            <span>Imprimir cupom ao finalizar a venda</span>
          </label>
          <p className="printer-modal__hint">
            Cupom interno da loja (não é NF-e).
          </p>

          <label>
            Impressora
            {qzOnline && printers.length > 0 ? (
              <select
                value={selectValue}
                onChange={(event) => setPrinterPath(event.target.value)}
                disabled={!canEdit || saving}
              >
                <option value="">Usar janela do Windows</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                  </option>
                ))}
                {printerPath &&
                printerPath !== BROWSER_PRINT_VALUE &&
                !printers.some((printer) => printer.name === printerPath) ? (
                  <option value={printerPath}>{printerPath} (atual)</option>
                ) : null}
              </select>
            ) : (
              <input
                value={printerPath}
                onChange={(event) => setPrinterPath(event.target.value)}
                disabled={!canEdit || saving}
                placeholder="Conecte o QZ Tray para listar"
              />
            )}
          </label>

          {!qzOnline && (
            <p className="printer-modal__hint">
              Sem QZ Tray, o Windows abre a janela de impressão ao vender.
            </p>
          )}

          <label>
            Largura do cupom
            <select
              value={paperWidth}
              onChange={(event) => setPaperWidth(normalizePaperWidth(event.target.value))}
              disabled={!canEdit || saving}
            >
              <option value="58mm">58 mm</option>
              <option value="80mm">80 mm</option>
            </select>
          </label>
        </section>

        {(localError || localOk) && (
          <p
            className={localError ? 'printer-modal__error' : 'printer-modal__ok'}
            role={localError ? 'alert' : 'status'}
          >
            {localError || localOk}
          </p>
        )}

        <div className="printer-modal__actions">
          <button
            type="button"
            className="printer-modal__ghost"
            onClick={() => void handleTest()}
            disabled={!canEdit || saving || testingPrint}
          >
            {testingPrint ? 'Testando…' : 'Testar impressão'}
          </button>
          <button
            type="button"
            className="printer-modal__primary"
            onClick={() => void handleSave()}
            disabled={!canEdit || saving}
          >
            {saving ? 'Salvando…' : 'Salvar impressora'}
          </button>
        </div>
      </div>
    </div>
  )
}
