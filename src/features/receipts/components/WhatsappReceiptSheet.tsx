import { useMemo, useState } from 'react'
import { formatMoney } from '../../../shared/lib/money'
import {
  formatWhatsappDisplay,
  normalizeWhatsappPhoneBr,
} from '../../../shared/lib/whatsapp'
import type { Organization } from '../../../shared/types'
import type { Sale } from '../../pos/types'
import {
  listRecentWhatsappPhones,
  openWhatsappReceipt,
} from '../whatsapp-receipt'
import './WhatsappReceiptSheet.css'

interface WhatsappReceiptSheetProps {
  sale: Sale
  organization: Organization
  initialPhone?: string
  copy?: 'original' | 'segunda_via'
  onClose: () => void
}

export function WhatsappReceiptSheet({
  sale,
  organization,
  initialPhone = '',
  copy = 'original',
  onClose,
}: WhatsappReceiptSheetProps) {
  const [phone, setPhone] = useState(() =>
    normalizeWhatsappPhoneBr(initialPhone)?.replace(/^55/, '') ??
      initialPhone.replace(/\D/g, ''),
  )
  const [error, setError] = useState<string | null>(null)
  const recent = useMemo(() => listRecentWhatsappPhones(), [])

  const normalizedPreview = normalizeWhatsappPhoneBr(phone)

  function handleSend() {
    setError(null)
    const result = openWhatsappReceipt({
      phone,
      sale,
      organization,
      copy,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
  }

  return (
    <div
      className="whatsapp-receipt-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-receipt-sheet-title"
    >
      <button
        type="button"
        className="whatsapp-receipt-sheet__backdrop"
        aria-label="Agora não"
        onClick={onClose}
      />
      <div className="whatsapp-receipt-sheet__card">
        <header>
          <div>
            <h2 id="whatsapp-receipt-sheet-title">Comprovante</h2>
            <p>
              Venda concluída · <strong>{formatMoney(sale.totalCents)}</strong>
              {sale.customerName ? ` · ${sale.customerName}` : ''}
            </p>
          </div>
        </header>

        <p className="whatsapp-receipt-sheet__hint">
          Abre o WhatsApp com o cupom pronto. Depois é só tocar em Enviar e voltar ao PDV.
        </p>

        <label className="whatsapp-receipt-sheet__phone">
          Telefone do cliente
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))
              setError(null)
            }}
            placeholder="11999999999"
            inputMode="tel"
            autoComplete="tel"
            autoFocus={!initialPhone}
          />
          {normalizedPreview && (
            <em>{formatWhatsappDisplay(normalizedPreview)}</em>
          )}
        </label>

        {recent.length > 0 && (
          <div className="whatsapp-receipt-sheet__recent">
            <span>Recentes neste aparelho</span>
            <div>
              {recent.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setPhone(item.replace(/^55/, ''))
                    setError(null)
                  }}
                >
                  {formatWhatsappDisplay(item)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="whatsapp-receipt-sheet__error" role="alert">
            {error}
          </p>
        )}

        <footer>
          <button type="button" className="whatsapp-receipt-sheet__skip" onClick={onClose}>
            Agora não
          </button>
          <button
            type="button"
            className="whatsapp-receipt-sheet__send"
            onClick={handleSend}
          >
            WhatsApp
          </button>
        </footer>
      </div>
    </div>
  )
}
