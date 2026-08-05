import { useMemo, useState, type FormEvent } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import { formatDateTime } from '../../../shared/lib/dates'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../../pos/types'
import { useCashRegister } from '../hooks/useCashRegister'
import { CASH_MOVEMENT_TYPES, CASH_SESSION_STATUS } from '../types'
import './CashRegisterPage.css'

type Panel = 'home' | 'sangria' | 'suprimento' | 'close'

export function CashRegisterPage() {
  const {
    organization,
    session,
    summary,
    recent,
    loading,
    busy,
    error,
    open,
    move,
    close,
  } = useCashRegister()

  const [panel, setPanel] = useState<Panel>('home')
  const [openingValue, setOpeningValue] = useState('0,00')
  const [movementValue, setMovementValue] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const closedRecent = useMemo(
    () => recent.filter((item) => item.status === CASH_SESSION_STATUS.CLOSED).slice(0, 5),
    [recent],
  )

  async function handleOpen(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    try {
      await open(parseMoneyToCents(openingValue))
      setOpeningValue('0,00')
    } catch {
      // erro no hook
    }
  }

  async function handleMovement(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    const amount = parseMoneyToCents(movementValue)
    if (amount <= 0) {
      setLocalError('Informe um valor válido.')
      return
    }
    try {
      await move(
        panel === 'sangria' ? CASH_MOVEMENT_TYPES.SANGRIA : CASH_MOVEMENT_TYPES.SUPRIMENTO,
        amount,
        movementReason,
      )
      setMovementValue('')
      setMovementReason('')
      setPanel('home')
    } catch {
      // erro no hook
    }
  }

  async function handleClose(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    try {
      await close(parseMoneyToCents(countedCash), closeNote)
      setCountedCash('')
      setCloseNote('')
      setPanel('home')
    } catch {
      // erro no hook
    }
  }

  function startClose() {
    if (summary) {
      setCountedCash((summary.expectedCashInDrawerCents / 100).toFixed(2).replace('.', ','))
    }
    setPanel('close')
  }

  if (!organization) {
    return <p className="cash-page__empty">Nenhuma loja ativa.</p>
  }

  if (loading) {
    return <p className="cash-page__empty">Carregando caixa…</p>
  }

  return (
    <section className="cash-page">
      <header className="cash-page__header">
        <div>
          <h1>Caixa</h1>
          <p>
            {session
              ? `Aberto desde ${formatDateTime(session.openedAt)} · ${session.openedByName}`
              : 'Abra o caixa para começar o dia.'}
          </p>
        </div>
        {session && (
          <span className="cash-page__badge">Aberto</span>
        )}
      </header>

      {(error || localError) && (
        <p className="cash-page__error" role="alert">
          {localError || error}
        </p>
      )}

      {!session && panel === 'home' && (
        <form className="cash-page__card" onSubmit={handleOpen}>
          <h2>Abrir caixa</h2>
          <p className="cash-page__hint">Informe o valor em dinheiro que está na gaveta agora.</p>
          <label>
            Valor inicial (R$)
            <input
              value={openingValue}
              onChange={(e) => setOpeningValue(e.target.value)}
              disabled={busy}
              placeholder="0,00"
              autoFocus
            />
          </label>
          <button type="submit" className="cash-page__primary" disabled={busy}>
            {busy ? 'Abrindo…' : 'Abrir caixa'}
          </button>
        </form>
      )}

      {session && panel === 'home' && summary && (
        <>
          <div className="cash-page__total-card">
            <span>Dinheiro esperado na gaveta</span>
            <strong>{formatMoney(summary.expectedCashInDrawerCents)}</strong>
          </div>

          <div className="cash-page__stats">
            <article>
              <span>Vendas</span>
              <strong>{summary.salesCount}</strong>
            </article>
            <article>
              <span>Faturamento</span>
              <strong>{formatMoney(summary.salesTotalCents)}</strong>
            </article>
            <article>
              <span>Sangrias</span>
              <strong>{formatMoney(summary.sangriaTotalCents)}</strong>
            </article>
            <article>
              <span>Suprimentos</span>
              <strong>{formatMoney(summary.suprimentoTotalCents)}</strong>
            </article>
          </div>

          <div className="cash-page__methods">
            <h2>Recebido por forma</h2>
            <ul>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <li key={method}>
                  <span>{PAYMENT_METHOD_LABELS[method]}</span>
                  <strong>{formatMoney(summary.paymentsByMethod[method])}</strong>
                </li>
              ))}
              {summary.changeTotalCents > 0 && (
                <li>
                  <span>Trocos dados</span>
                  <strong>{formatMoney(summary.changeTotalCents)}</strong>
                </li>
              )}
            </ul>
          </div>

          <div className="cash-page__actions">
            <button type="button" onClick={() => setPanel('sangria')} disabled={busy}>
              Sangria
            </button>
            <button type="button" onClick={() => setPanel('suprimento')} disabled={busy}>
              Suprimento
            </button>
            <button
              type="button"
              className="cash-page__primary"
              onClick={startClose}
              disabled={busy}
            >
              Fechar caixa
            </button>
          </div>

          {session.movements.length > 0 && (
            <div className="cash-page__card">
              <h2>Movimentos</h2>
              <ul className="cash-page__movements">
                {[...session.movements].reverse().map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>
                        {item.type === CASH_MOVEMENT_TYPES.SANGRIA ? 'Sangria' : 'Suprimento'}
                      </strong>
                      <span>
                        {formatDateTime(item.createdAt)}
                        {item.reason ? ` · ${item.reason}` : ''}
                      </span>
                    </div>
                    <strong>
                      {item.type === CASH_MOVEMENT_TYPES.SANGRIA ? '−' : '+'}
                      {formatMoney(item.amountCents)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {session && (panel === 'sangria' || panel === 'suprimento') && (
        <form className="cash-page__card" onSubmit={handleMovement}>
          <h2>{panel === 'sangria' ? 'Sangria' : 'Suprimento'}</h2>
          <p className="cash-page__hint">
            {panel === 'sangria'
              ? 'Retirada de dinheiro da gaveta.'
              : 'Entrada de dinheiro na gaveta (reforço).'}
          </p>
          <label>
            Valor (R$)
            <input
              value={movementValue}
              onChange={(e) => setMovementValue(e.target.value)}
              disabled={busy}
              placeholder="0,00"
              autoFocus
            />
          </label>
          <label>
            Motivo (opcional)
            <input
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              disabled={busy}
              placeholder="Ex.: pagamento de fornecedor"
            />
          </label>
          <div className="cash-page__form-actions">
            <button type="button" className="cash-page__ghost" onClick={() => setPanel('home')} disabled={busy}>
              Voltar
            </button>
            <button type="submit" className="cash-page__primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      )}

      {session && panel === 'close' && summary && (
        <form className="cash-page__card" onSubmit={handleClose}>
          <h2>Fechar caixa</h2>
          <p className="cash-page__hint">
            Esperado na gaveta: <strong>{formatMoney(summary.expectedCashInDrawerCents)}</strong>
          </p>
          <label>
            Quanto tem na gaveta agora? (R$)
            <input
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              disabled={busy}
              placeholder="0,00"
              autoFocus
            />
          </label>
          {countedCash && (
            <p className="cash-page__diff">
              Diferença:{' '}
              <strong>
                {formatMoney(parseMoneyToCents(countedCash) - summary.expectedCashInDrawerCents)}
              </strong>
            </p>
          )}
          <label>
            Observação (opcional)
            <input
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="cash-page__form-actions">
            <button type="button" className="cash-page__ghost" onClick={() => setPanel('home')} disabled={busy}>
              Voltar
            </button>
            <button type="submit" className="cash-page__primary" disabled={busy}>
              {busy ? 'Fechando…' : 'Confirmar fechamento'}
            </button>
          </div>
        </form>
      )}

      {!session && closedRecent.length > 0 && (
        <div className="cash-page__card">
          <h2>Últimos fechamentos</h2>
          <ul className="cash-page__recent">
            {closedRecent.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.closedAt ? formatDateTime(item.closedAt) : '—'}</strong>
                  <span>{item.closedByName}</span>
                </div>
                <div className="cash-page__recent-right">
                  <span>
                    Contado{' '}
                    {formatMoney(item.countedCashInDrawerCents ?? 0)}
                  </span>
                  <strong
                    className={
                      (item.differenceCents ?? 0) === 0
                        ? undefined
                        : (item.differenceCents ?? 0) > 0
                          ? 'cash-page__positive'
                          : 'cash-page__negative'
                    }
                  >
                    Dif. {formatMoney(item.differenceCents ?? 0)}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
