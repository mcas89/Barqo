import { useState, type FormEvent } from 'react'
import { parseMoneyToCents } from '../../../shared/lib/money'
import type { Customer } from '../../customers'
import type { CreateReceivableInput } from '../types'
import './ReceivableForm.css'

interface ReceivableFormProps {
  customers: Customer[]
  saving: boolean
  onSubmit: (input: CreateReceivableInput) => Promise<void>
  onCancel: () => void
}

export function ReceivableForm({
  customers,
  saving,
  onSubmit,
  onCancel,
}: ReceivableFormProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    const customer = customers.find((item) => item.id === customerId)
    if (!customer) {
      setLocalError('Selecione um cliente.')
      return
    }

    const totalCents = parseMoneyToCents(amount)
    if (totalCents <= 0) {
      setLocalError('Informe o valor.')
      return
    }

    try {
      await onSubmit({
        customerId: customer.id,
        customerName: customer.name,
        totalCents,
        description,
      })
    } catch {
      // erro no hook
    }
  }

  if (customers.length === 0) {
    return (
      <div className="receivable-form">
        <p className="receivable-form__error">
          Cadastre um cliente antes de lançar fiado.
        </p>
        <button type="button" onClick={onCancel}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <form className="receivable-form" onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Cliente
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          disabled={saving}
          required
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Valor (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={saving}
          placeholder="0,00"
          required
          autoFocus
        />
      </label>
      <label>
        Descrição
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          placeholder="Ex.: fiado avulso"
        />
      </label>

      {localError && (
        <p className="receivable-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="receivable-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Lançar fiado'}
        </button>
      </div>
    </form>
  )
}
