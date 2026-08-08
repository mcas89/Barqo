import { formatDateTime } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import {
  RECEIVABLE_STATUS,
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

function lastPaidAt(item: Receivable): string | null {
  if (!item.payments.length) return null
  let latest: string | null = null
  for (const payment of item.payments) {
    if (!payment.paidAt) continue
    if (!latest || payment.paidAt > latest) latest = payment.paidAt
  }
  return latest
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
        const paidAt = lastPaidAt(item)
        const isPaid = item.status === RECEIVABLE_STATUS.PAID
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
              {paidAt && (
                <em className="receivable-list__paid-at">
                  {isPaid ? 'Quitado em' : 'Último pagamento em'}{' '}
                  {formatDateTime(paidAt)}
                </em>
              )}
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
