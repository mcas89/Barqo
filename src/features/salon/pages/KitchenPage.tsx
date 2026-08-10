import { Link } from 'react-router-dom'
import { formatDateTime } from '../../../shared/lib/dates'
import { useSalon } from '../hooks/useSalon'
import { PREP_STATUSES, PREP_STATUS_LABELS } from '../types'
import './SalonShared.css'

export function KitchenPage() {
  const salon = useSalon()

  if (!salon.hasSalon) {
    return (
      <section className="salon-page">
        <h1>Cozinha</h1>
        <p className="salon-page__upgrade">{salon.upgradeHint}</p>
        <Link to="/app/billing">Ver planos</Link>
      </section>
    )
  }

  if (!salon.canKitchen) {
    return (
      <section className="salon-page">
        <h1>Cozinha</h1>
        <p>Sem permissão para a cozinha.</p>
      </section>
    )
  }

  return (
    <section className="salon-page salon-page--kitchen">
      <header className="salon-page__header">
        <div>
          <h1>Cozinha</h1>
          <p>Fila de preparo em tempo real</p>
        </div>
        <div className="salon-page__links">
          <Link to="/app/salon">Mesas</Link>
          {salon.canWaiter && <Link to="/app/salon/waiter">Garçom</Link>}
        </div>
      </header>

      {salon.error && <p className="salon-ticket__error">{salon.error}</p>}

      {salon.loading ? (
        <p>Carregando fila…</p>
      ) : salon.kitchenQueue.length === 0 ? (
        <p className="salon-page__empty">Nada na fila agora.</p>
      ) : (
        <div className="kitchen-board">
          {salon.kitchenQueue.map(({ ticketId, tableName, item }) => (
            <article
              key={`${ticketId}-${item.id}`}
              className={`kitchen-card kitchen-card--${item.prepStatus}`}
            >
              <header>
                <strong>{tableName}</strong>
                <span>{formatDateTime(item.addedAt)}</span>
              </header>
              <h2>
                {item.quantity}× {item.name}
              </h2>
              {item.note ? <p className="kitchen-card__note">{item.note}</p> : null}
              <p className="kitchen-card__status">{PREP_STATUS_LABELS[item.prepStatus]}</p>
              <div className="kitchen-card__actions">
                {item.prepStatus === PREP_STATUSES.QUEUED && (
                  <button
                    type="button"
                    disabled={salon.busy}
                    onClick={() =>
                      void salon.setPrepStatus(ticketId, item.id, PREP_STATUSES.PREPARING)
                    }
                  >
                    Preparar
                  </button>
                )}
                {(item.prepStatus === PREP_STATUSES.QUEUED ||
                  item.prepStatus === PREP_STATUSES.PREPARING) && (
                  <button
                    type="button"
                    className="salon-ticket__primary"
                    disabled={salon.busy}
                    onClick={() =>
                      void salon.setPrepStatus(ticketId, item.id, PREP_STATUSES.READY)
                    }
                  >
                    Pronto
                  </button>
                )}
                {item.prepStatus === PREP_STATUSES.READY && (
                  <button
                    type="button"
                    disabled={salon.busy}
                    onClick={() =>
                      void salon.setPrepStatus(ticketId, item.id, PREP_STATUSES.DELIVERED)
                    }
                  >
                    Entregue
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
