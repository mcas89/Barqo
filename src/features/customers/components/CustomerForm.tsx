import { useState, type FormEvent } from 'react'
import type { Customer, CustomerInput } from '../types'
import './CustomerForm.css'

interface CustomerFormProps {
  initial?: Customer | null
  saving: boolean
  onSubmit: (input: CustomerInput) => Promise<void>
  onCancel: () => void
}

export function CustomerForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [document, setDocument] = useState(initial?.document ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (!name.trim()) {
      setLocalError('Informe o nome.')
      return
    }
    try {
      await onSubmit({
        name,
        phone,
        document,
        note,
        active: initial?.active ?? true,
      })
    } catch {
      // erro no hook
    }
  }

  return (
    <form className="customer-form" onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Nome
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          required
          autoFocus
        />
      </label>
      <label>
        Telefone
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={saving}
          placeholder="(00) 00000-0000"
        />
      </label>
      <label>
        CPF/CNPJ
        <input
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          disabled={saving}
        />
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
        <p className="customer-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="customer-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}
        </button>
      </div>
    </form>
  )
}
