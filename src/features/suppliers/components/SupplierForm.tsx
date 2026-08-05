import { useState, type FormEvent } from 'react'
import type { Supplier, SupplierInput } from '../types'
import './SupplierForm.css'

interface SupplierFormProps {
  initial?: Supplier | null
  saving: boolean
  onSubmit: (input: SupplierInput) => Promise<void>
  onCancel: () => void
}

export function SupplierForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  const isEdit = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? '')
  const [contactName, setContactName] = useState(initial?.contactName ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [document, setDocument] = useState(initial?.document ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
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
        contactName,
        phone,
        document,
        category,
        note,
        active: initial?.active ?? true,
      })
    } catch {
      // erro no hook
    }
  }

  return (
    <form className="supplier-form" onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Fornecedor
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          required
          autoFocus
        />
      </label>
      <label>
        Contato
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          disabled={saving}
          placeholder="Nome de quem atende"
        />
      </label>
      <label>
        Telefone / WhatsApp
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={saving}
        />
      </label>
      <label>
        CNPJ
        <input
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          disabled={saving}
        />
      </label>
      <label>
        O que fornece
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={saving}
          placeholder="Ex.: bebidas, limpeza, hortifruti"
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
        <p className="supplier-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="supplier-form__actions">
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
