import { Link } from 'react-router-dom'
import { formatDayLabel, formatDateTime } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import { HomePlanNotice } from '../../billing/components/HomePlanNotice'
import { PAYMENT_METHOD_LABELS } from '../../pos'
import { useDayDashboard } from '../hooks/useDayDashboard'
import './HomePage.css'

export function HomePage() {
  const { organization, summary, loading, refreshing, error, refresh } =
    useDayDashboard()

  if (!organization) {
    return <p className="home-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="home-page">
      <HomePlanNotice />
      <header className="home-page__header">
        <div>
          <h1>Painel do dia</h1>
          <p>
            {organization.name} · {formatDayLabel()}
          </p>
        </div>
        <button
          type="button"
          className="home-page__refresh"
          onClick={() => void refresh(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      {error && (
        <p className="home-page__error" role="alert">
          {error}
        </p>
      )}

      <nav className="home-page__shortcuts" aria-label="Atalhos">
        <Link to="/app/pos" className="home-page__shortcut home-page__shortcut--primary">
          Abrir PDV
        </Link>
        <Link to="/app/products" className="home-page__shortcut">
          Produtos
        </Link>
        <Link to="/app/cash" className="home-page__shortcut">
          Caixa
        </Link>
        <Link to="/app/customers" className="home-page__shortcut">
          Clientes
        </Link>
      </nav>

      {loading || !summary ? (
        <p className="home-page__empty">Carregando painel…</p>
      ) : (
        <>
          <div
            className={
              summary.cashOpen
                ? 'home-page__cash home-page__cash--open'
                : 'home-page__cash home-page__cash--closed'
            }
          >
            {summary.cashOpen ? (
              <>
                <strong>Caixa aberto</strong>
                <span>{summary.cashOpenedByName ?? '—'}</span>
              </>
            ) : (
              <>
                <strong>Caixa fechado</strong>
                <Link to="/app/pos">Abrir no PDV</Link>
              </>
            )}
          </div>

          <div className="home-page__kpis">
            <article className="home-page__kpi">
              <span>Faturamento</span>
              <strong>{formatMoney(summary.salesTotalCents)}</strong>
            </article>
            <article className="home-page__kpi">
              <span>Vendas</span>
              <strong>{summary.salesCount}</strong>
            </article>
            <article className="home-page__kpi">
              <span>Ticket médio</span>
              <strong>{formatMoney(summary.ticketAverageCents)}</strong>
            </article>
            <article className="home-page__kpi">
              <span>Troco dado</span>
              <strong>{formatMoney(summary.changeTotalCents)}</strong>
            </article>
          </div>

          <div className="home-page__grid">
            <section className="home-page__panel">
              <h2>Formas de pagamento</h2>
              {summary.payments.length === 0 ? (
                <p className="home-page__muted">Nenhuma venda hoje ainda.</p>
              ) : (
                <ul className="home-page__rows">
                  {summary.payments.map((row) => (
                    <li key={row.method}>
                      <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
                      <strong>{formatMoney(row.amountCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="home-page__panel">
              <h2>Mais vendidos hoje</h2>
              {summary.topProducts.length === 0 ? (
                <p className="home-page__muted">Sem itens ainda.</p>
              ) : (
                <ul className="home-page__rows">
                  {summary.topProducts.map((item) => (
                    <li key={item.productId}>
                      <span>
                        {item.name}
                        <em>
                          {item.quantity} un.
                        </em>
                      </span>
                      <strong>{formatMoney(item.totalCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="home-page__panel">
              <h2>Últimas vendas</h2>
              {summary.recentSales.length === 0 ? (
                <p className="home-page__muted">Nenhuma venda registrada hoje.</p>
              ) : (
                <ul className="home-page__rows">
                  {summary.recentSales.map((sale) => (
                    <li key={sale.id}>
                      <span>
                        {formatDateTime(sale.createdAt)}
                        <em>{sale.soldByName || sale.customerName || 'Caixa livre'}</em>
                      </span>
                      <strong>{formatMoney(sale.totalCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="home-page__panel">
              <div className="home-page__panel-head">
                <h2>Estoque baixo</h2>
                <Link to="/app/inventory">Ver estoque</Link>
              </div>
              {summary.lowStock.length === 0 ? (
                <p className="home-page__muted">Nenhum alerta agora.</p>
              ) : (
                <ul className="home-page__rows">
                  {summary.lowStock.map((item) => (
                    <li key={item.id}>
                      <span>{item.name}</span>
                      <strong className="home-page__warn">
                        {item.stock} / mín. {item.minStock}
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
