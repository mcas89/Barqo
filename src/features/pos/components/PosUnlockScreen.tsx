import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BALQO_LOGO_SRC } from '../../../shared/constants'
import { useAuth } from '../../../shared/hooks/useAuth'
import { listLiveOperatorPresences, OperatorInUseError } from '../../devices'
import { usePosOperator } from '../hooks/usePosOperator'
import {
  canAccessBackOffice,
  POS_ROLE_LABELS,
  type PosOperator,
} from '../types/operator'
import { getPinLockRemainingMs } from '../../users/services/pin-lock'
import './PosUnlockScreen.css'

function notifyBusy(message: string) {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification('BALQO — PIN em uso', { body: message })
    }
  } catch {
    // ignore
  }
}

export function PosUnlockScreen() {
  const { organization } = useAuth()
  const navigate = useNavigate()
  const {
    operators,
    loading,
    error,
    clearError,
    unlock,
    setupOwnerPin,
    refreshOperators,
  } = usePosOperator()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [busyNotice, setBusyNotice] = useState<string | null>(null)
  const [lockTick, setLockTick] = useState(0)
  const [presences, setPresences] = useState<
    Array<{ operatorId: string; displayName: string; deviceLabel: string }>
  >([])
  const pinRef = useRef<HTMLInputElement>(null)

  const selected: PosOperator | null =
    operators.find((op) => op.id === selectedId) ?? null
  const needsSetup = Boolean(selected && selected.kind === 'owner' && !selected.hasPin)
  const pinLockMs =
    organization?.id && selected
      ? getPinLockRemainingMs(organization.id, selected.id) + lockTick * 0
      : 0
  const pinLocked = pinLockMs > 0
  const pinLockLabel =
    pinLockMs >= 60_000
      ? `${Math.ceil(pinLockMs / 60_000)} min`
      : `${Math.ceil(pinLockMs / 1000)}s`

  useEffect(() => {
    if (!pinLocked) return
    const timer = window.setInterval(() => setLockTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [pinLocked, selectedId])


  useEffect(() => {
    if (operators.length === 1 && !selectedId) {
      setSelectedId(operators[0].id)
    }
  }, [operators, selectedId])

  useEffect(() => {
    if (selectedId) {
      setPin('')
      setPinConfirm('')
      setLocalError(null)
      setBusyNotice(null)
      clearError()
      window.setTimeout(() => pinRef.current?.focus(), 50)
    }
  }, [selectedId, clearError])

  useEffect(() => {
    if (!organization?.id) return
    const orgId: string = organization.id
    let cancelled = false
    async function load() {
      try {
        const live = await listLiveOperatorPresences(orgId)
        if (!cancelled) setPresences(live)
      } catch {
        if (!cancelled) setPresences([])
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 12_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [organization?.id])

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined)
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return

    setLocalError(null)
    setBusyNotice(null)
    clearError()
    setBusy(true)

    try {
      if (needsSetup) {
        if (pin !== pinConfirm) {
          setLocalError('Os PINs não conferem.')
          return
        }
        await setupOwnerPin(pin)
        const session = await unlock(selected.id, pin)
        if (!canAccessBackOffice(session.role)) {
          navigate('/app/pos', { replace: true })
        }
        return
      }

      const session = await unlock(selected.id, pin)
      if (!canAccessBackOffice(session.role)) {
        navigate('/app/pos', { replace: true })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível entrar com este PIN.'
      setLocalError(message)
      if (err instanceof OperatorInUseError || message.toLowerCase().includes('já está')) {
        setBusyNotice(message)
        notifyBusy(message)
      }
    } finally {
      setBusy(false)
      setPin('')
      setPinConfirm('')
    }
  }

  if (loading) {
    return (
      <section className="pos-unlock">
        <p className="pos-unlock__loading">Carregando operadores…</p>
      </section>
    )
  }

  return (
    <section className="pos-unlock">
      <header className="pos-unlock__header">
        <div className="pos-unlock__brand">
          <img
            src={organization?.logoDataUrl || BALQO_LOGO_SRC}
            alt={organization?.name || 'BALQO'}
          />
        </div>
        <p className="pos-unlock__shop">{organization?.name || 'PDV'}</p>
        <h1>Quem está usando?</h1>
        <p>Selecione o usuário e digite o PIN. O sistema libera as telas do seu papel.</p>
      </header>

      {busyNotice && (
        <p className="pos-unlock__notice" role="alert">
          {busyNotice}
        </p>
      )}

      <div className="pos-unlock__grid">
        {operators.map((op) => {
          const active = op.id === selectedId
          const presence = presences.find((item) => item.operatorId === op.id)
          return (
            <button
              key={op.id}
              type="button"
              className={[
                'pos-unlock__op',
                active ? 'pos-unlock__op--active' : '',
                presence ? 'pos-unlock__op--busy' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedId(op.id)}
              disabled={busy}
            >
              <strong>{op.displayName}</strong>
              <span>{POS_ROLE_LABELS[op.role]}</span>
              {presence ? (
                <em>Em uso em {presence.deviceLabel}</em>
              ) : !op.hasPin && op.kind === 'owner' ? (
                <em>Definir PIN</em>
              ) : null}
            </button>
          )
        })}
      </div>

      {selected && (
        <form className="pos-unlock__form" onSubmit={(e) => void handleSubmit(e)}>
          <h2>
            {needsSetup
              ? `Criar PIN — ${selected.displayName}`
              : `PIN — ${selected.displayName}`}
          </h2>

          {pinLocked && (
            <p className="pos-unlock__error" role="alert">
              PIN bloqueado. Aguarde {pinLockLabel} ou peça ao dono/gerente para
              redefinir o PIN na Equipe.
            </p>
          )}

          {needsSetup && (
            <p className="pos-unlock__hint">
              Crie um PIN de 4 a 6 dígitos para o proprietário. Ele será pedido ao
              abrir o sistema.
            </p>
          )}

          <label>
            PIN
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={busy || pinLocked}
              required
              placeholder="••••"
            />
          </label>

          {needsSetup && (
            <label>
              Confirmar PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={busy || pinLocked}
                required
                placeholder="••••"
              />
            </label>
          )}

          {(localError || error) && (
            <p className="pos-unlock__error" role="alert">
              {localError || error}
            </p>
          )}

          <button type="submit" disabled={busy || pinLocked || pin.length < 4}>
            {busy ? 'Entrando…' : needsSetup ? 'Salvar PIN e entrar' : 'Entrar'}
          </button>
        </form>
      )}

      <div className="pos-unlock__footer">
        <button
          type="button"
          className="pos-unlock__refresh"
          onClick={() => void refreshOperators()}
          disabled={busy}
        >
          Atualizar lista
        </button>
      </div>
    </section>
  )
}
