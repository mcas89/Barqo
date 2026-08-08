import { useState } from 'react'
import { formatDateTime } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import {
  RECEIVABLE_STATUS_LABELS,
  type CustomerReceivableAccount,
} from '../types'
import './ReceivableList.css'

interface ReceivableListProps {
  accounts: CustomerReceivableAccount[]
  onReceive: (account: CustomerReceivableAccount) => void
  onExpand: (account: CustomerReceivableAccount) => Promise<CustomerReceivableAccount>
  busy?: boolean
}

const STATUS_LABEL = {
  open: 'Em aberto',
  partial: 'Parcial',
  paid: 'Quitado',
} as const

export function ReceivableList({
  accounts,
  onReceive,
  onExpand,
  busy,
}: ReceivableListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, CustomerReceivableAccount>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (accounts.length === 0) {
    return <p className="receivable-list__empty">Nenhuma conta em aberto.</p>
  }

  async function toggle(account: CustomerReceivableAccount) {
    const key = account.customerId + ':' + account.status
    if (expandedId === key) {
      setExpandedId(null)
      return
    }
    setExpandedId(key)
    if (details[key]) return
    setLoadingId(key)
    try {
      const enriched = await onExpand(account)
      setDetails((current) => ({ ...current, [key]: enriched }))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <ul className="receivable-list">
      {accounts.map((account) => {
        const key = account.customerId + ':' + account.status
        const open = account.openCents
        const canReceive = account.status === 'open' || account.status === 'partial'
        const expanded = expandedId === key
        const detail = details[key] ?? account
        return (
          <li key={key} className={expanded ? 'receivable-list__item--open' : undefined}>
            <button
              type="button"
              className="receivable-list__main"
              onClick={() => void toggle(account)}
            >
              <div>
                <strong>{account.customerName}</strong>
                <span>
                  {STATUS_LABEL[account.status]}
                  {` · ${account.chargeCount} lançamento(s)`}
                </span>
                <em>
                  Total {formatMoney(account.totalCents)}
                  {account.paidCents > 0
                    ? ` · pago ${formatMoney(account.paidCents)}`
                    : ''}
                </em>
                {account.status === 'paid' && account.lastPaidAt && (
                  <em className="receivable-list__paid-at">
                    Quitado em {formatDateTime(account.lastPaidAt)}
                  </em>
                )}
              </div>
              <div className="receivable-list__side">
                <strong>{formatMoney(open)}</strong>
                <span className="receivable-list__chevron">
                  {expanded ? 'Fechar' : 'Abrir'}
                </span>
              </div>
            </button>

            {canReceive && (
              <div className="receivable-list__receive">
                <button
                  type="button"
                  onClick={() => onReceive(account)}
                  disabled={busy}
                >
                  Receber
                </button>
              </div>
            )}

            {expanded && (
              <div className="receivable-list__detail">
                {loadingId === key ? (
                  <p>Carregando lançamentos…</p>
                ) : (
                  <ul>
                    {detail.charges.map((charge) => (
                      <li key={charge.receivable.id}>
                        <div className="receivable-list__charge-head">
                          <strong>{formatDateTime(charge.receivable.createdAt)}</strong>
                          <span>
                            {RECEIVABLE_STATUS_LABELS[charge.receivable.status]} ·{' '}
                            {formatMoney(charge.receivable.totalCents)}
                            {charge.openCents > 0
                              ? ` · em aberto ${formatMoney(charge.openCents)}`
                              : ''}
                          </span>
                        </div>
                        {charge.receivable.description && (
                          <p>{charge.receivable.description}</p>
                        )}
                        {charge.saleItems && charge.saleItems.length > 0 ? (
                          <ul className="receivable-list__items">
                            {charge.saleItems.map((item, index) => (
                              <li key={`${charge.receivable.id}-${index}`}>
                                {item.quantity}x {item.name} —{' '}
                                {formatMoney(item.totalCents)}
                              </li>
                            ))}
                          </ul>
                        ) : charge.receivable.saleId ? (
                          <p className="receivable-list__muted">Venda PDV</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
