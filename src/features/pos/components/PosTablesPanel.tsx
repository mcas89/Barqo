import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '../../../shared/lib/money'
import { useSalon } from '../../salon/hooks/useSalon'
import {
  ticketItemCount,
  ticketTotalCents,
  type SalonTicket,
} from '../../salon/types'
import { uniqueOpenTickets } from '../../salon/services/salon-service'
import './PosTablesPanel.css'

interface PosTablesPanelProps {
  onClose: () => void
  /** Carrega a comanda no carrinho do PDV. */
  onSelect: (ticket: SalonTicket) => void
}

/** Mesas abertas no PDV — ao tocar, preenche o carrinho. */
export function PosTablesPanel({ onClose, onSelect }: PosTablesPanelProps) {
  const salon = useSalon()

  const openTickets = useMemo(
    () => uniqueOpenTickets(salon.tickets),
    [salon.tickets],
  )

  return (
    <div className="pos-tables" role="dialog" aria-labelledby="pos-tables-title">
      <button
        type="button"
        className="pos-tables__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="pos-tables__card">
        <header>
          <div>
            <h2 id="pos-tables-title">Mesas</h2>
            <p>Toque para carregar no caixa</p>
          </div>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        {salon.error && (
          <p className="pos-tables__error" role="alert">
            {salon.error}
          </p>
        )}

        {salon.loading ? (
          <p className="pos-tables__empty">Carregando mesas…</p>
        ) : openTickets.length === 0 ? (
          <p className="pos-tables__empty">
            Nenhuma mesa aberta no momento.
            {salon.canTables ? (
              <>
                {' '}
                <Link to="/app/salon" onClick={onClose}>
                  Gerenciar mesas
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <ul className="pos-tables__list">
            {openTickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => onSelect(ticket)}
                >
                  <span>
                    <strong>{ticket.tableName}</strong>
                    <em>{ticketItemCount(ticket.items)} item(ns)</em>
                  </span>
                  <strong>{formatMoney(ticketTotalCents(ticket))}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}

        {salon.canTables && openTickets.length > 0 && (
          <Link to="/app/salon" className="pos-tables__manage" onClick={onClose}>
            Abrir tela de mesas
          </Link>
        )}
      </div>
    </div>
  )
}
