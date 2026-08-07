import { Link } from 'react-router-dom'
import { formatPlanPrice } from '../../billing'
import { formatDateTime, formatShortDate } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import { PAYMENT_METHOD_LABELS } from '../../pos'
import { ReprintSaleButton } from '../../receipts'
import { usePeriodReport } from '../hooks/usePeriodReport'
import { periodSummaryToCsv } from '../services/period-summary'
import './ReportsPage.css'

export function ReportsPage() {
  const {
    organization,
    canUsePeriod,
    canExport,
    upgradeHint,
    preset,
    fromInput,
    toInput,
    setFromInput,
    setToInput,
    applyPreset,
    summary,
    loading,
    error,
  } = usePeriodReport()

  function downloadCsv() {
    if (!summary) return
    const blob = new Blob([periodSummaryToCsv(summary)], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `balqo-relatorio-${fromInput}-a-${toInput}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!organization) {
    return <p className="reports-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="reports-page">
      <header className="reports-page__header">
        <div>
          <h1>Relatórios</h1>
          <p>
            {organization.name}
            {summary
              ? ` · ${formatShortDate(summary.fromIso)} a ${formatShortDate(summary.toIso)}`
              : ''}
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            className="reports-page__export"
            onClick={downloadCsv}
            disabled={!summary || summary.salesCount === 0}
          >
            Exportar CSV
          </button>
        )}
      </header>

      {canUsePeriod ? (
        <div className="reports-page__filters">
          <div className="reports-page__presets">
            <button
              type="button"
              className={preset === 'today' ? 'is-active' : undefined}
              onClick={() => applyPreset('today')}
            >
              Hoje
            </button>
            <button
              type="button"
              className={preset === '7d' ? 'is-active' : undefined}
              onClick={() => applyPreset('7d')}
            >
              7 dias
            </button>
            <button
              type="button"
              className={preset === '30d' ? 'is-active' : undefined}
              onClick={() => applyPreset('30d')}
            >
              30 dias
            </button>
            <button
              type="button"
              className={preset === 'custom' ? 'is-active' : undefined}
              onClick={() => applyPreset('custom')}
            >
              Personalizado
            </button>
          </div>
          <div className="reports-page__dates">
            <label>
              De
              <input
                type="date"
                value={fromInput}
                onChange={(e) => {
                  setFromInput(e.target.value)
                  applyPreset('custom')
                }}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value)
                  applyPreset('custom')
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="reports-page__basic-note">
          <p>
            No plano Solo o relatório mostra só o <strong>dia de hoje</strong>.{' '}
            {upgradeHint}
          </p>
          <Link to="/app/billing">Ver planos · Equipe {formatPlanPrice('essencial')}</Link>
        </div>
      )}

      {error && (
        <p className="reports-page__error" role="alert">
          {error}
        </p>
      )}

      {loading || !summary ? (
        <p className="reports-page__empty">Carregando relatório…</p>
      ) : (
        <>
          <div className="reports-page__kpis">
            <article>
              <span>Total vendido</span>
              <strong>{formatMoney(summary.salesTotalCents)}</strong>
            </article>
            <article>
              <span>Recebido (sem fiado)</span>
              <strong>
                {formatMoney(Math.max(0, summary.salesTotalCents - summary.fiadoCents))}
              </strong>
            </article>
            <article>
              <span>Fiado a receber</span>
              <strong>{formatMoney(summary.fiadoCents)}</strong>
            </article>
            <article>
              <span>Vendas</span>
              <strong>{summary.salesCount}</strong>
            </article>
          </div>

          <div className="reports-page__grid">
            <section className="reports-page__panel">
              <h2>Formas de pagamento</h2>
              {summary.payments.length === 0 ? (
                <p className="reports-page__muted">Sem vendas no período.</p>
              ) : (
                <ul>
                  {summary.payments.map((row) => (
                    <li key={row.method}>
                      <span>
                        {PAYMENT_METHOD_LABELS[row.method]}
                        {row.method === 'on_account' ? ' (a receber)' : ''}
                      </span>
                      <strong>{formatMoney(row.amountCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="reports-page__panel">
              <h2>Por operador</h2>
              {summary.operators.length === 0 ? (
                <p className="reports-page__muted">Sem operadores no período.</p>
              ) : (
                <ul>
                  {summary.operators.map((row) => (
                    <li key={row.key}>
                      <span>
                        {row.name}
                        <em>{row.salesCount} venda(s)</em>
                      </span>
                      <strong>{formatMoney(row.totalCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="reports-page__panel reports-page__panel--wide">
              <h2>Produtos mais vendidos</h2>
              {summary.products.length === 0 ? (
                <p className="reports-page__muted">Sem itens no período.</p>
              ) : (
                <ul>
                  {summary.products.map((row) => (
                    <li key={row.productId}>
                      <span>
                        {row.name}
                        <em>{row.quantity} un.</em>
                      </span>
                      <strong>{formatMoney(row.totalCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="reports-page__panel reports-page__panel--wide">
              <h2>Vendas do período</h2>
              {summary.sales.length === 0 ? (
                <p className="reports-page__muted">Nenhuma venda encontrada.</p>
              ) : (
                <ul>
                  {summary.sales.slice(0, 40).map((sale) => (
                    <li key={sale.id}>
                      <span>
                        {formatDateTime(sale.createdAt)}
                        <em>
                          {sale.soldByName}
                          {sale.customerName ? ` · ${sale.customerName}` : ''}
                        </em>
                      </span>
                      <strong className="reports-page__sale-total">
                        {formatMoney(sale.totalCents)}
                        <ReprintSaleButton sale={sale} />
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
