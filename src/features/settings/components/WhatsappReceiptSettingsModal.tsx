import { useEffect, useState } from 'react'
import { formatWhatsappDisplay, normalizeWhatsappPhoneBr } from '../../../shared/lib/whatsapp'
import { whatsappUrl } from '../../../shared/lib/whatsapp'
import './WhatsappReceiptSettingsModal.css'

export interface WhatsappReceiptSettingsValue {
  offerWhatsappReceiptOnSale: boolean
}

export function WhatsappReceiptSettingsModal({
  initial,
  canEdit,
  saving,
  storeWhatsapp,
  onClose,
  onSave,
}: {
  initial: WhatsappReceiptSettingsValue
  canEdit: boolean
  saving?: boolean
  storeWhatsapp?: string
  onClose: () => void
  onSave: (value: WhatsappReceiptSettingsValue) => Promise<void>
}) {
  const [enabled, setEnabled] = useState(initial.offerWhatsappReceiptOnSale)
  const [testPhone, setTestPhone] = useState(storeWhatsapp ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const [localOk, setLocalOk] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(initial.offerWhatsappReceiptOnSale)
  }, [initial.offerWhatsappReceiptOnSale])

  async function handleSave() {
    setLocalError(null)
    setLocalOk(null)
    try {
      await onSave({ offerWhatsappReceiptOnSale: enabled })
      setLocalOk('Configuração salva.')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar.')
    }
  }

  function handleTest() {
    setLocalError(null)
    setLocalOk(null)
    const phone = normalizeWhatsappPhoneBr(testPhone)
    if (!phone) {
      setLocalError('Informe um telefone válido com DDD para testar.')
      return
    }
    const text =
      'Teste BALQO\n\nSe você recebeu esta mensagem pronta, o envio de comprovante via WhatsApp está ok.\nSó toque em Enviar.'
    const url = whatsappUrl(phone, text)
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.assign(url)
    } catch {
      window.location.assign(url)
    }
    setLocalOk('WhatsApp aberto — confira a mensagem e toque em Enviar.')
  }

  return (
    <div
      className="whatsapp-receipt-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-receipt-title"
    >
      <button
        type="button"
        className="whatsapp-receipt-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="whatsapp-receipt-modal__card">
        <header>
          <h2 id="whatsapp-receipt-title">Comprovante WhatsApp</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        <p className="whatsapp-receipt-modal__lead">
          Abre o WhatsApp com o cupom pronto. O operador só toca em Enviar — sem robô e sem
          conexão de API.
        </p>

        <label className="whatsapp-receipt-modal__check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!canEdit || saving}
          />
          Oferecer WhatsApp ao concluir a venda
        </label>

        <div className="whatsapp-receipt-modal__test">
          <strong>Testar</strong>
          <span>Use o número da loja ou o seu para validar.</span>
          <label>
            Telefone
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder="11999999999"
              inputMode="tel"
              disabled={saving}
            />
          </label>
          {testPhone && normalizeWhatsappPhoneBr(testPhone) && (
            <em>{formatWhatsappDisplay(normalizeWhatsappPhoneBr(testPhone)!)}</em>
          )}
          <button type="button" onClick={handleTest} disabled={saving}>
            Abrir WhatsApp de teste
          </button>
        </div>

        {localError && (
          <p className="whatsapp-receipt-modal__error" role="alert">
            {localError}
          </p>
        )}
        {localOk && <p className="whatsapp-receipt-modal__ok">{localOk}</p>}

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="whatsapp-receipt-modal__primary" onClick={() => void handleSave()} disabled={!canEdit || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
