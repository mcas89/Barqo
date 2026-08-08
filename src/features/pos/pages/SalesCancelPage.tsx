import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, formatDayLabel } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import { PinAuthorizeModal } from '../components/PinAuthorizeModal'
import { useSaleCancel } from '../hooks/useSaleCancel'
import { PAYMENT_METHOD_LABELS, type Sale } from '../types'
import './SalesCancelPage.css'

export function SalesCancelPage() {
  const {
    organization,
    sales,
    loading,
    busy,
    error,
    setError,
    search,
    setSearch,
    includeCanceled,
    setIncludeCanceled,
    refresh,
    needsPrivilegedPin,
    cancelWithPin,
  } = useSaleCancel()

  const [selected, setSelected] = useState<Sale | null>(null)
  const [reason, setReason] = useState('')
  const [askPin, setAskPin] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!organization) {
    return <p className="sales-cancel__empty">Nenhuma loja ativa.</p>
  }

  function openCancel(sale: Sale) {
    setSelected(sale)
    setReason('')
    setLocalError(null)
    setError(null)
  }

  function requestCancel() {
    if (!selected || selected.status === 'canceled') return
    setLocalError(null)
    if (reason.trim().length < 3) {
      setLocalError('Informe o motivo (mín. 3 caracteres).')
      return
    }
    if (needsPrivilegedPin) {
      setAskPin(true)
      return
    }
    void runCancel().catch(() => undefined)
  }

  async function runCancel(pin?: string) {
    if (!selected) return
    await cancelWithPin(selected.id, reason, pin)
    setAskPin(false)
    setSelected(null)
    setReason('')
  }

  const hasCash = Boolean(
    selected?.payments?.some((payment) => payment.method === 'cash' && payment.amountCents > 0),
  )
  const hasFiado = Boolean(
    selected?.payments?.some(
      (payment) => payment.method === 'on_account' && payment.amountCents > 0,
    ),
  )

  return (
    <section className="sales-cancel">
      <header className="sales-cancel__header">
        <div>
          <h1>Cancelar venda</h1>
          <p>
            {organization.name} · {formatDayLabel()} · devolução e estorno do dia
          </p>
        </div>
        <button
          type="button"
          className="sales-cancel__ghost"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          Atualizar
        </button>
      </header>

      <p className="sales-cancel__intro">
        Cancela a venda no caixa e no faturamento, devolve o estoque e cancela o fiado
        vinculado (se ainda não foi pago). Operação online, com motivo e autorização.
      </p>

      {(error || localError) && (
        <p className="sales-cancel__error" role="alert">
          {localError || error}
        </p>
      )}

      <div className="sales-cancel__toolbar">
        <input
          type="search"
          placeholder="Buscar por cliente, produto ou id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="sales-cancel__check">
          <input
            type="checkbox"
            checked={includeCanceled}
            onChange={(e) => setIncludeCanceled(e.target.checked)}
          />
          Mostrar canceladas
        </label>
      </div>

      <div className="sales-cancel__layout">
        <div className="sales-cancel__list-panel">
          {loading ? (
            <p className="sales-cancel__empty">Carregando vendas de hoje…</p>
          ) : sales.length === 0 ? (
            <p className="sales-cancel__empty">Nenhuma venda encontrada hoje.</p>
          ) : (
            <ul className="sales-cancel__list">
              {sales.map((sale) => (
                <li key={sale.id}>
                  <button
                    type="button"
                    className={
                      selected?.id === sale.id
                        ? 'sales-cancel__row sales-cancel__row--active'
                        : sale.status === 'canceled'
                          ? 'sales-cancel__row sales-cancel__row--canceled'
                          : 'sales-cancel__row'
                    }
                    onClick={() => openCancel(sale)}
                  >
                    <span>
                      <strong>{formatDateTime(sale.createdAt)}</strong>
                      <em>
                        {sale.customerName || '-'}
                        {sale.status === 'canceled' ? ' · cancelada' : ''}
                      </em>
                    </span>
                    <strong>{formatMoney(sale.totalCents)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sales-cancel__detail">
          {!selected ? (
            <p className="sales-cancel__empty">Selecione uma venda à esquerda.</p>
          ) : (
            <>
              <header>
                <h2>
                  {selected.status === 'canceled' ? 'Venda cancelada' : 'Detalhe da venda'}
                </h2>
                <p>{selected.id}</p>
              </header>

              <ul className="sales-cancel__meta">
                <li>
                  <span>Horário</span>
                  <strong>{formatDateTime(selected.createdAt)}</strong>
                </li>
                <li>
                  <span>Cliente</span>
                  <strong>{selected.customerName || '-'}</strong>
                </li>
                <li>
                  <span>Operador</span>
                  <strong>{selected.soldByName}</strong>
                </li>
                <li>
                  <span>Total</span>
                  <strong>{formatMoney(selected.totalCents)}</strong>
                </li>
              </ul>

              <h3>Itens</h3>
              <ul className="sales-cancel__items">
                {(selected.items ?? []).map((item) => (
                  <li key={`${item.productId}-${item.name}`}>
                    <span>
                      {item.name}
                      <em>
                        {item.quantity} × {formatMoney(item.unitPriceCents)}
                      </em>
                    </span>
                    <strong>{formatMoney(item.totalCents)}</strong>
                  </li>
                ))}
              </ul>

              <h3>Pagamentos</h3>
              <ul className="sales-cancel__items">
                {(selected.payments ?? []).map((payment) => (
                  <li key={payment.method}>
                    <span>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</span>
                    <strong>{formatMoney(payment.amountCents)}</strong>
                  </li>
                ))}
              </ul>

              {selected.status === 'canceled' ? (
                <aside className="sales-cancel__note">
                  Cancelada em{' '}
                  {selected.canceledAt ? formatDateTime(selected.canceledAt) : '—'}
                  {selected.canceledByName ? ` por ${selected.canceledByName}` : ''}
                  {selected.cancelReason ? `. Motivo: ${selected.cancelReason}` : ''}
                </aside>
              ) : (
                <>
                  {(hasCash || hasFiado) && (
                    <aside className="sales-cancel__note" role="note">
                      {hasCash
                        ? 'Se foi em dinheiro, retire o valor da gaveta ou registre uma sangria no Caixa. '
                        : ''}
                      {hasFiado
                        ? 'O fiado em aberto será cancelado automaticamente.'
                        : ''}
                    </aside>
                  )}

                  <label className="sales-cancel__reason">
                    Motivo do cancelamento
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Ex.: cliente desistiu / item errado"
                      disabled={busy}
                    />
                  </label>

                  <div className="sales-cancel__actions">
                    <Link to="/app/cash" className="sales-cancel__ghost-link">
                      Ir ao caixa
                    </Link>
                    <button
                      type="button"
                      className="sales-cancel__danger"
                      onClick={requestCancel}
                      disabled={busy}
                    >
                      {busy ? 'Cancelando…' : 'Cancelar esta venda'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {askPin && (
        <PinAuthorizeModal
          title="Autorizar cancelamento"
          description="Só proprietário ou gerente pode cancelar venda. Digite o PIN."
          busy={busy}
          onConfirm={(pin) => runCancel(pin)}
          onCancel={() => setAskPin(false)}
        />
      )}
    </section>
  )
}
