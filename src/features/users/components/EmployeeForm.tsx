import { useEffect, useState, type FormEvent } from 'react'
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  type Employee,
  type EmployeeInput,
  type EmployeeRole,
} from '../types'
import {
  EDITABLE_PERMISSIONS,
  PERMISSION_LABELS,
  defaultPermissionsForRole,
  type PermissionKey,
  type PermissionOverrides,
} from '../permissions'
import './EmployeeForm.css'

interface EmployeeFormProps {
  initial?: Employee | null
  saving: boolean
  finePermissions?: boolean
  /** Na edição, PIN vazio = manter o atual. */
  onSubmit: (input: EmployeeInput) => Promise<void>
  onCancel: () => void
}

export function EmployeeForm({
  initial,
  saving,
  finePermissions = false,
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
  const [permissions, setPermissions] = useState<PermissionOverrides>(() => {
    if (!finePermissions) return {}
    return {
      ...defaultPermissionsForRole(initial?.role ?? EMPLOYEE_ROLES.CASHIER),
      ...initial?.permissions,
    }
  })
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!finePermissions) return
    setPermissions({
      ...defaultPermissionsForRole(role),
      ...(initial?.role === role ? initial.permissions : undefined),
    })
  }, [role, finePermissions, initial])

  function togglePermission(key: PermissionKey) {
    setPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

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
        permissions: finePermissions ? permissions : undefined,
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

      {finePermissions && (
        <fieldset className="employee-form__perms">
          <legend>Permissões finas (Controle)</legend>
          <p>Ajuste o que este funcionário pode fazer além do padrão da função.</p>
          <div className="employee-form__perms-grid">
            {EDITABLE_PERMISSIONS.map((key) => (
              <label key={key} className="employee-form__perm">
                <input
                  type="checkbox"
                  checked={Boolean(permissions[key])}
                  onChange={() => togglePermission(key)}
                  disabled={saving}
                />
                <span>{PERMISSION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

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
