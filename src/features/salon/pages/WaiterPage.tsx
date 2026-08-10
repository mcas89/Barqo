import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '../../../shared/lib/money'
import { TicketPanel } from '../components/TicketPanel'
import { useSalon } from '../hooks/useSalon'
import {
  ticketItemCount,
  ticketTotalCents,
  type SalonTable,
  type SalonTicket,
} from '../types'
import './SalonShared.css'

/** Visão mobile-first do garçom: abrir mesa e lançar itens. */
export function WaiterPage() {
  const salon = useSalon()
  const [activeTicket, setActiveTicket] = useState<SalonTicket | null>(null)

  const tables = useMemo(
    () =>
      salon.tables
        .filter((table) => table.active)
        .sort((a, b) => {
          const aBusy = salon.ticketByTableId.has(a.id) ? 0 : 1
          const bBusy = salon.ticketByTableId.has(b.id) ? 0 : 1
          if (aBusy !== bBusy) return aBusy - bBusy
          return a.number - b.number
        }),
    [salon.tables, salon.ticketByTableId],
  )

  const openCount = tables.filter((table) => salon.ticketByTableId.has(table.id)).length

  const liveTicket =
    activeTicket &&
    (salon.tickets.find((ticket) => ticket.id === activeTicket.id) ?? activeTicket)

  async function handleOpenTable(table: SalonTable) {
    const ticket = await salon.openOrGetTicket(table)
    setActiveTicket(ticket)
  }

  if (!salon.hasSalon) {
    return (
      <section className="salon-page">
        <h1>Garçom</h1>
        <p className="salon-page__upgrade">{salon.upgradeHint}</p>
        <Link to="/app/billing">Ver planos</Link>
      </section>
    )
  }

  if (!salon.canWaiter) {
    return (
      <section className="salon-page">
        <h1>Garçom</h1>
        <p>Sem permissão de garçom.</p>
      </section>
    )
  }

  return (
    <section
      className={
        liveTicket
          ? 'salon-page salon-page--waiter salon-page--waiter-ticket'
          : 'salon-page salon-page--waiter'
      }
    >
      {!liveTicket && (
        <header className="waiter-top">
          <div>
            <p className="waiter-top__eyebrow">Salão</p>
            <h1>Mesas</h1>
          </div>
          <p className="waiter-top__meta">
            {openCount > 0 ? `${openCount} aberta(s)` : 'Todas livres'}
          </p>
        </header>
      )}

      {salon.error && <p className="salon-ticket__error">{salon.error}</p>}

      {salon.loading ? (
        <p className="salon-page__empty">Carregando mesas…</p>
      ) : liveTicket ? (
        <TicketPanel
          ticket={liveTicket}
          products={salon.products}
          busy={salon.busy}
          canAdd
          canClose={false}
          orderEntry
          onBack={() => setActiveTicket(null)}
          onSendOrder={async (lines) => {
            const updated = await salon.sendOrderToTicket({
              ticketId: liveTicket.id,
              lines,
            })
            setActiveTicket(updated)
          }}
          onRemoveItem={async (itemId) => {
            const updated = await salon.removeTicketItem(liveTicket.id, itemId)
            if (updated) setActiveTicket(updated)
          }}
        />
      ) : tables.length === 0 ? (
        <p className="salon-page__empty">
          Nenhuma mesa cadastrada. Peça ao responsável para cadastrar em Mesas.
        </p>
      ) : (
        <div className="waiter-map" role="list">
          {tables.map((table) => {
            const ticket = salon.ticketByTableId.get(table.id)
            const busy = Boolean(ticket)
            return (
              <button
                key={table.id}
                type="button"
                role="listitem"
                className={busy ? 'waiter-tile waiter-tile--busy' : 'waiter-tile'}
                disabled={salon.busy}
                onClick={() => void handleOpenTable(table)}
              >
                <span className="waiter-tile__badge">{busy ? 'Aberta' : 'Livre'}</span>
                <strong className="waiter-tile__name">{table.name}</strong>
                {ticket ? (
                  <span className="waiter-tile__info">
                    {ticketItemCount(ticket.items)} itens
                    <em>{formatMoney(ticketTotalCents(ticket))}</em>
                  </span>
                ) : (
                  <span className="waiter-tile__info">Toque para abrir</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
