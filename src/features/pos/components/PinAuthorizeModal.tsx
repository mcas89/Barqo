import { useEffect, useRef, useState, type FormEvent } from 'react'
import './PinAuthorizeModal.css'

interface PinAuthorizeModalProps {
  title?: string
  description?: string
  busy?: boolean
  error?: string | null
  onConfirm: (pin: string) => Promise<void>
  onCancel: () => void
}

export function PinAuthorizeModal({
  title = 'Autorização necessária',
  description = 'Digite o PIN do proprietário ou gerente para continuar.',
  busy,
  error,
  onConfirm,
  onCancel,
}: PinAuthorizeModalProps) {
  const [pin, setPin] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (pin.length < 4) {
      setLocalError('Informe o PIN.')
      return
    }
    try {
      await onConfirm(pin)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'PIN inválido.')
      setPin('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="pin-auth" role="dialog" aria-modal="true" aria-labelledby="pin-auth-title">
      <button type="button" className="pin-auth__backdrop" aria-label="Fechar" onClick={onCancel} />
      <form className="pin-auth__card" onSubmit={(e) => void handleSubmit(e)}>
        <h2 id="pin-auth-title">{title}</h2>
        <p>{description}</p>
        <label>
          PIN
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={busy}
            required
          />
        </label>
        {(localError || error) && (
          <p className="pin-auth__error" role="alert">
            {localError || error}
          </p>
        )}
        <div className="pin-auth__actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" disabled={busy || pin.length < 4}>
            {busy ? 'Verificando…' : 'Autorizar'}
          </button>
        </div>
      </form>
    </div>
  )
}
