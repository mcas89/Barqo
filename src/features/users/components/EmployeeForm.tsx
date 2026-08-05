import { useState, type FormEvent } from 'react'
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  type Employee,
  type EmployeeInput,
  type EmployeeRole,
} from '../types'
import './EmployeeForm.css'

interface EmployeeFormProps {
  initial?: Employee | null
  saving: boolean
  /** Na edição, PIN vazio = manter o atual. */
  onSubmit: (input: EmployeeInput) => Promise<void>
  onCancel: () => void
}

export function EmployeeForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const isEdit = Boolean(initial)
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')
  const [role, setRole] = useState<EmployeeRole>(
    initial?.role ?? EMPLOYEE_ROLES.CASHIER,
  )
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    const name = displayName.trim()
    if (!name) {
      setLocalError('Informe o nome.')
      return
    }

    if (!isEdit || pin.trim()) {
      if (pin !== pinConfirm) {
        setLocalError('Os PINs não conferem.')
        return
      }
      if (!/^\d{4,6}$/.test(pin.trim())) {
        setLocalError('PIN deve ter 4 a 6 dígitos.')
        return
      }
    }

    try {
      await onSubmit({
        displayName: name,
        role,
        pin: pin.trim(),
      })
    } catch {
      // erro no hook
    }
  }

  return (
    <form className="employee-form" onSubmit={(e) => void handleSubmit(e)}>
      <label>
        Nome
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={saving}
          required
          autoFocus
        />
      </label>

      <label>
        Função
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as EmployeeRole)}
          disabled={saving}
        >
          {Object.values(EMPLOYEE_ROLES).map((value) => (
            <option key={value} value={value}>
              {EMPLOYEE_ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label>
        PIN {isEdit ? '(deixe em branco para manter)' : ''}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={saving}
          required={!isEdit}
          placeholder="4 a 6 dígitos"
        />
      </label>

      {(!isEdit || pin.trim()) && (
        <label>
          Confirmar PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pinConfirm}
            onChange={(e) =>
              setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            disabled={saving}
            required={!isEdit || Boolean(pin.trim())}
          />
        </label>
      )}

      {localError && (
        <p className="employee-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="employee-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </form>
  )
}
