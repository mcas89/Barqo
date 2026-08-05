import { useEffect, useState } from 'react'
import {
  listSystemPrinters,
  type SystemPrinter,
} from '../../receipts/print-agent'
import {
  normalizePaperWidth,
  type ReceiptPaperWidth,
} from '../../receipts'
import './PrinterSettingsModal.css'

const AGENT_BAT_URL = '/print-agent/iniciar-impressora-balqo.bat'
const AGENT_PS1_URL = '/print-agent/balqo-print-agent.ps1'

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
  const [agentOnline, setAgentOnline] = useState(false)
  const [checkingAgent, setCheckingAgent] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localOk, setLocalOk] = useState<string | null>(null)

  const value: PrinterSettingsValue = {
    printOnSale,
    sendReceiptOnSale: false,
    printerPath,
    paperWidth,
  }

  async function refreshAgent() {
    setCheckingAgent(true)
    setLocalError(null)
    try {
      const listed = await listSystemPrinters()
      setAgentOnline(listed.agentOnline)
      setPrinters(listed.printers)
      if (
        listed.agentOnline &&
        !printerPath.trim() &&
        listed.printers.some((printer) => printer.isDefault)
      ) {
        const preferred = listed.printers.find((printer) => printer.isDefault)
        if (preferred) setPrinterPath(preferred.name)
      }
    } finally {
      setCheckingAgent(false)
    }
  }

  useEffect(() => {
    void refreshAgent()
  }, [])

  function downloadAgentFiles() {
    setLocalOk(null)
    const linkBat = document.createElement('a')
    linkBat.href = AGENT_BAT_URL
    linkBat.download = 'iniciar-impressora-balqo.bat'
    linkBat.click()
    window.setTimeout(() => {
      const linkPs1 = document.createElement('a')
      linkPs1.href = AGENT_PS1_URL
      linkPs1.download = 'balqo-print-agent.ps1'
      linkPs1.click()
    }, 400)
    setLocalOk('Download iniciado. Guarde os dois arquivos na mesma pasta no PC do caixa.')
  }

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
      setLocalOk('Teste enviado. Confira a impressora ou a janela do Windows.')
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
      <div className="printer-modal__card" role="dialog" aria-modal="true" aria-labelledby="printer-modal-title">
        <header>
          <h2 id="printer-modal-title">Configurar impressora</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div
          className={
            agentOnline
              ? 'printer-modal__status printer-modal__status--ok'
              : 'printer-modal__status printer-modal__status--off'
          }
        >
          <strong>
            {checkingAgent
              ? 'Verificando agente…'
              : agentOnline
                ? 'Agente conectado'
                : 'Agente desconectado'}
          </strong>
          <span>
            {agentOnline
              ? 'Impressão silenciosa disponível neste PC.'
              : 'Sem o agente, o Windows abre a janela de impressão.'}
          </span>
          <button type="button" onClick={() => void refreshAgent()} disabled={checkingAgent}>
            {checkingAgent ? 'Verificando…' : 'Atualizar status'}
          </button>
        </div>

        <section className="printer-modal__block">
          <h3>Agente local (Windows)</h3>
          <p>
            O PWA sozinho não imprime em silêncio. Baixe o agente, coloque os dois arquivos na
            mesma pasta no PC do caixa e rode <strong>iniciar-impressora-balqo.bat</strong>.
            Deixe a janela aberta enquanto vende.
          </p>
          <ol>
            <li>Baixe os dois arquivos e salve juntos (ex.: pasta BALQO no Desktop).</li>
            <li>Dê dois cliques no .bat e deixe a janela aberta.</li>
            <li>Volte aqui, atualize o status e escolha a impressora.</li>
            <li>
              Se o Windows bloquear: clique direito → Propriedades → Desbloquear, ou “Executar
              assim mesmo”.
            </li>
          </ol>
          <div className="printer-modal__downloads">
            <button type="button" className="printer-modal__primary" onClick={downloadAgentFiles}>
              Baixar agente (bat + ps1)
            </button>
            <a href={AGENT_BAT_URL} download>
              Só o .bat
            </a>
            <a href={AGENT_PS1_URL} download>
              Só o .ps1
            </a>
          </div>
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
          <label
            className="printer-modal__switch printer-modal__switch--disabled"
            onClick={(event) => {
              event.preventDefault()
              setLocalError(null)
              setLocalOk(null)
              setLocalError(
                'Envio de comprovante por e-mail está indisponível para manutenção.',
              )
            }}
          >
            <input
              type="checkbox"
              checked={false}
              disabled
              readOnly
              aria-disabled="true"
            />
            <span>Enviar comprovante (e-mail) ao finalizar — indisponível</span>
          </label>
          <p className="printer-modal__hint">
            Em manutenção. O cupom impresso continua disponível.
          </p>

          <label>
            Impressora
            {agentOnline && printers.length > 0 ? (
              <select
                value={selectValue}
                onChange={(event) => setPrinterPath(event.target.value)}
                disabled={!canEdit || saving}
              >
                <option value="">Usar janela do Windows</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                    {printer.isDefault ? ' (padrão)' : ''}
                  </option>
                ))}
                {printerPath && !printers.some((printer) => printer.name === printerPath) ? (
                  <option value={printerPath}>{printerPath} (atual)</option>
                ) : null}
              </select>
            ) : (
              <input
                value={printerPath}
                onChange={(event) => setPrinterPath(event.target.value)}
                disabled={!canEdit || saving}
                placeholder="Nome exato no Windows, ex.: ELGIN i9"
              />
            )}
          </label>

          {!agentOnline && (
            <p className="printer-modal__hint">
              Com o agente desligado, digite o nome da impressora para guardar. A lista aparece
              quando o agente estiver conectado.
            </p>
          )}

          {agentOnline && printers.length === 0 && (
            <p className="printer-modal__hint">
              Agente online, mas nenhuma impressora foi listada. Confira o driver no Windows.
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
