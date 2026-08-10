import { useMemo, useState } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type SalePayment,
} from '../../pos/types'
import { ticketTotalCents, type SalonTicket } from '../types'
import './../pages/SalonShared.css'

interface CloseTicketModalProps {
  ticket: SalonTicket
  busy?: boolean
  onCancel: () => void
  onConfirm: (input: {
    payments: SalePayment[]
    discountCents: number
    note?: string
  }) => Promise<void>
}

export function CloseTicketModal({
  ticket,
  busy,
  onCancel,
  onConfirm,
}: CloseTicketModalProps) {
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS.PIX)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const discountCents = Math.max(0, parseMoneyToCents(discount))
  const due = useMemo(
    () => ticketTotalCents({ items: ticket.items, discountCents }),
    [ticket.items, discountCents],
  )

  async function handleSubmit() {
    setError(null)
    if (due <= 0) {
      setError('Comanda sem valor para fechar.')
      return
    }
    const paid = amount.trim() ? parseMoneyToCents(amount) : due
    if (paid < due) {
      setError('Valor pago insuficiente.')
      return
    }
    try {
      await onConfirm({
        payments: [{ method, amountCents: paid }],
        discountCents,
        note: note.trim() || ticket.tableName,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao fechar a conta.')
    }
  }

  return (
    <div className="salon-close" role="dialog" aria-modal="true">
      <button type="button" className="salon-close__backdrop" onClick={onCancel} />
      <section className="salon-close__panel">
        <header>
          <h2>Fechar {ticket.tableName}</h2>
          <p>Total: {formatMoney(due)}</p>
        </header>

        <label>
          Desconto (R$)
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={busy} />
        </label>

        <label>
          Forma de pagamento
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            disabled={busy}
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
              .filter((key) => key !== PAYMENT_METHODS.ON_ACCOUNT)
              .map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_METHOD_LABELS[key]}
                </option>
              ))}
          </select>
        </label>

        <label>
          Valor pago (R$)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={(due / 100).toFixed(2).replace('.', ',')}
            disabled={busy}
          />
        </label>

        <label>
          Observação
          <input value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        </label>

        {error && <p className="salon-ticket__error">{error}</p>}

        <div className="salon-close__actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="salon-ticket__primary"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            Confirmar fechamento
          </button>
        </div>
      </section>
    </div>
  )
}
