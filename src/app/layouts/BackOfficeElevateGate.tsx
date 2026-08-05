import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePosOperator } from '../../features/pos/hooks/usePosOperator'
import './BackOfficeElevateGate.css'

export function BackOfficeElevateGate({ path }: { path: string }) {
  const navigate = useNavigate()
  const { elevateForPath, operator } = usePosOperator()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await elevateForPath(path, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN inválido.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="elevate-gate">
      <p className="elevate-gate__eyebrow">Área restrita</p>
      <h1>Permissão de gerente necessária</h1>
      <p>
        {operator?.displayName || 'Este operador'} não acessa esta área. Peça o PIN do
        proprietário ou gerente para liberar só esta tela. Ao sair, as permissões
        voltam ao normal.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label>
          PIN do proprietário ou gerente
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={busy}
            required
            autoFocus
            placeholder="••••"
          />
        </label>
        {error && (
          <p className="elevate-gate__error" role="alert">
            {error}
          </p>
        )}
        <div className="elevate-gate__actions">
          <button type="button" onClick={() => navigate('/app/pos')} disabled={busy}>
            Voltar ao PDV
          </button>
          <button type="submit" disabled={busy || pin.length < 4}>
            {busy ? 'Verificando…' : 'Liberar tela'}
          </button>
        </div>
      </form>
    </section>
  )
}
