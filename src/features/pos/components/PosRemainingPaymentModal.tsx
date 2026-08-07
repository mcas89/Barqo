import { useEffect, useRef, useState } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  type SalePayment,
} from '../types'
import './PosRemainingPaymentModal.css'

interface PosRemainingPaymentModalProps {
  totalCents: number
  payments: SalePayment[]
  methods: PaymentMethod[]
  busy?: boolean
  onConfirm: (payments: SalePayment[]) => void
  onCancel: () => void
}

function paymentsTotal(list: SalePayment[]) {
  return list.reduce((sum, payment) => sum + payment.amountCents, 0)
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function upsertPayment(
  list: SalePayment[],
  method: PaymentMethod,
  amountCents: number,
): SalePayment[] {
  const others = list.filter((payment) => payment.method !== method)
  if (amountCents <= 0) return others
  return [...others, { method, amountCents }]
}

export function PosRemainingPaymentModal({
  totalCents,
  payments: initialPayments,
  methods,
  busy,
  onConfirm,
  onCancel,
}: PosRemainingPaymentModalProps) {
  const [payments, setPayments] = useState(initialPayments)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [amountDraft, setAmountDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const paidCents = paymentsTotal(payments)
  const remainingCents = Math.max(0, totalCents - paidCents)

  useEffect(() => {
    setPayments(initialPayments)
  }, [initialPayments])

  useEffect(() => {
    if (selectedMethod === PAYMENT_METHODS.CASH) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [selectedMethod])

  const availableMethods = methods.filter((method) => {
    const used = payments.some((payment) => payment.method === method)
    return remainingCents > 0 || used
  })

  function chooseMethod(method: PaymentMethod) {
    setError(null)
    setSelectedMethod(method)
    setAmountDraft(centsToInput(remainingCents))

    if (method !== PAYMENT_METHODS.CASH && remainingCents > 0) {
      const next = upsertPayment(payments, method, remainingCents)
      const nextPaid = paymentsTotal(next)
      if (nextPaid >= totalCents) {
        onConfirm(next)
        return
      }
      setPayments(next)
      setSelectedMethod(null)
      setAmountDraft('')
    }
  }

  function applyCash() {
    if (!selectedMethod || selectedMethod !== PAYMENT_METHODS.CASH) return
    setError(null)
    const amount = parseMoneyToCents(amountDraft)
    if (amount <= 0) {
      setError('Informe o valor em dinheiro.')
      return
    }

    const next = upsertPayment(payments, PAYMENT_METHODS.CASH, amount)
    const nextPaid = paymentsTotal(next)
    if (nextPaid >= totalCents) {
      onConfirm(next)
      return
    }
    setPayments(next)
    setSelectedMethod(null)
    setAmountDraft('')
  }

  return (
    <div
      className="pos-remaining"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-remaining-title"
    >
      <button
        type="button"
        className="pos-remaining__backdrop"
        aria-label="Cancelar"
        onClick={onCancel}
        disabled={busy}
      />
      <div className="pos-remaining__card">
        <header>
          <div>
            <h2 id="pos-remaining-title">Falta pagar</h2>
            <p>
              Total {formatMoney(totalCents)} · pago {formatMoney(paidCents)}
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy}>
            Voltar
          </button>
        </header>

        <div className="pos-remaining__due">
          <span>Valor restante</span>
          <strong>{formatMoney(remainingCents)}</strong>
        </div>

        {payments.length > 0 && (
          <ul className="pos-remaining__lines">
            {payments.map((payment) => (
              <li key={payment.method}>
                {PAYMENT_METHOD_LABELS[payment.method]} ·{' '}
                {formatMoney(payment.amountCents)}
              </li>
            ))}
          </ul>
        )}

        <p className="pos-remaining__label">Como vai pagar o restante?</p>
        <div className="pos-remaining__grid">
          {availableMethods.map((method) => (
            <button
              key={method}
              type="button"
              className={
                selectedMethod === method
                  ? 'pos-remaining__btn pos-remaining__btn--active'
                  : 'pos-remaining__btn'
              }
              onClick={() => chooseMethod(method)}
              disabled={busy || remainingCents <= 0}
            >
              {PAYMENT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>

        {selectedMethod === PAYMENT_METHODS.CASH && (
          <label className="pos-remaining__cash">
            Valor em dinheiro
            <div className="pos-remaining__cash-row">
              <input
                ref={inputRef}
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyCash()
                  }
                }}
                placeholder="0,00"
                inputMode="decimal"
                disabled={busy}
              />
              <button type="button" onClick={applyCash} disabled={busy}>
                OK
              </button>
            </div>
          </label>
        )}

        {error && (
          <p className="pos-remaining__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
