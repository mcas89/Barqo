import { formatDateTime } from '../../../shared/lib/dates'
import { STOCK_MOVEMENT_LABELS, type StockMovement } from '../types'
import './MovementList.css'

interface MovementListProps {
  movements: StockMovement[]
}

export function MovementList({ movements }: MovementListProps) {
  if (movements.length === 0) {
    return <p className="movement-list__empty">Nenhuma movimentação ainda.</p>
  }

  return (
    <ul className="movement-list">
      {movements.map((movement) => {
        const positive = movement.quantity > 0
        const zero = movement.quantity === 0
        return (
          <li key={movement.id}>
            <div>
              <strong>{movement.productName}</strong>
              <span>
                {STOCK_MOVEMENT_LABELS[movement.type]} · {formatDateTime(movement.createdAt)}
                {movement.createdByName ? ` · ${movement.createdByName}` : ''}
              </span>
              {movement.note && <em>{movement.note}</em>}
            </div>
            <div className="movement-list__qty">
              <strong
                className={
                  zero
                    ? undefined
                    : positive
                      ? 'movement-list__qty--in'
                      : 'movement-list__qty--out'
                }
              >
                {positive ? '+' : ''}
                {movement.quantity}
              </strong>
              <span>
                {movement.stockBefore} → {movement.stockAfter}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
