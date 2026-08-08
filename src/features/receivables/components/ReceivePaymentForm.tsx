import { useState, type FormEvent } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../pos'
import type { CustomerReceivableAccount, ReceivePaymentInput } from '../types'
import './ReceivePaymentForm.css'

interface ReceivePaymentFormProps {
  account: CustomerReceivableAccount
  saving: boolean
  onSubmit: (input: ReceivePaymentInput) => Promise<void>
  onCancel: () => void
}

const METHODS: PaymentMethod[] = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.PIX,
  PAYMENT_METHODS.DEBIT,
  PAYMENT_METHODS.CREDIT,
]

export function ReceivePaymentForm({
  account,
  saving,
  onSubmit,
  onCancel,
}: ReceivePaymentFormProps) {
  const open = account.openCents
  const [amount, setAmount] = useState((open / 100).toFixed(2).replace('.', ','))
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS.CASH)
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    const amountCents = parseMoneyToCents(amount)
    if (amountCents <= 0) {
      setLocalError('Informe o valor.')
      return
    }
    if (amountCents > open) {
      setLocalError(`Máximo em aberto: ${formatMoney(open)}.`)
      return
    }

    try {
      await onSubmit({ amountCents, method, note })
    } catch {
      // erro no hook
    }
  }

  return (
    <form className="receive-pay-form" onSubmit={(e) => void handleSubmit(e)}>
      <header>
        <h2>Receber de {account.customerName}</h2>
        <p>
          Em aberto: {formatMoney(open)} · {account.chargeCount} lançamento(s)
        </p>
        <p className="receive-pay-form__hint">
          O valor baixa os lançamentos mais antigos primeiro. Dinheiro exige caixa
          aberto e entra na gaveta como suprimento.
        </p>
      </header>

      <label>
        Valor (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={saving}
          required
          autoFocus
        />
      </label>

      <label>
        Forma
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          disabled={saving}
        >
          {METHODS.map((item) => (
            <option key={item} value={item}>
              {PAYMENT_METHOD_LABELS[item]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Observação
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
      </label>

      {localError && (
        <p className="receive-pay-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="receive-pay-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Confirmar recebimento'}
        </button>
      </div>
    </form>
  )
}
