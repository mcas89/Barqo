import { formatMoney } from '../../../shared/lib/money'
import {
  RECEIVABLE_STATUS_LABELS,
  remainingCents,
  type Receivable,
} from '../types'
import './ReceivableList.css'

interface ReceivableListProps {
  items: Receivable[]
  onReceive: (item: Receivable) => void
  busy?: boolean
}

export function ReceivableList({ items, onReceive, busy }: ReceivableListProps) {
  if (items.length === 0) {
    return <p className="receivable-list__empty">Nenhuma conta em aberto.</p>
  }

  return (
    <ul className="receivable-list">
      {items.map((item) => {
        const open = remainingCents(item)
        const canReceive = item.status === 'open' || item.status === 'partial'
        return (
          <li key={item.id}>
            <div>
              <strong>{item.customerName}</strong>
              <span>
                {RECEIVABLE_STATUS_LABELS[item.status]}
                {item.description ? ` · ${item.description}` : ''}
                {item.saleId ? ' · venda PDV' : ''}
              </span>
              <em>
                Total {formatMoney(item.totalCents)} · pago {formatMoney(item.paidCents)}
              </em>
            </div>
            <div className="receivable-list__side">
              <strong>{formatMoney(open)}</strong>
              {canReceive && (
                <button
                  type="button"
                  onClick={() => onReceive(item)}
                  disabled={busy}
                >
                  Receber
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
