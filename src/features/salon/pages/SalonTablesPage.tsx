import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '../../../shared/lib/money'
import { getOpenCashSession } from '../../cash-register'
import { useDeviceSession } from '../../devices'
import { completeSale } from '../../pos/services/sale-service'
import type { SalePayment } from '../../pos/types'
import { fulfillSaleReceipt, resolveReceiptSettings } from '../../receipts'
import { CloseTicketModal } from '../components/CloseTicketModal'
import { TicketPanel } from '../components/TicketPanel'
import { useSalon } from '../hooks/useSalon'
import {
  PREP_STATUSES,
  ticketItemCount,
  ticketTotalCents,
  type SalonTable,
  type SalonTicket,
} from '../types'
import './SalonShared.css'

export function SalonTablesPage() {
  const salon = useSalon()
  const { deviceId } = useDeviceSession()
  const [activeTicket, setActiveTicket] = useState<SalonTicket | null>(null)
  const [closing, setClosing] = useState(false)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const activeTables = useMemo(
    () => salon.tables.filter((table) => table.active).sort((a, b) => a.number - b.number),
    [salon.tables],
  )
  const nextNumber = useMemo(() => {
    if (activeTables.length === 0) return 1
    return Math.max(...activeTables.map((table) => table.number)) + 1
  }, [activeTables])

  if (!salon.hasSalon) {
    return (
      <section className="salon-page">
        <h1>Salão</h1>
        <p className="salon-page__upgrade">{salon.upgradeHint}</p>
        <Link to="/app/billing">Ver planos</Link>
      </section>
    )
  }

  if (!salon.canTables && !salon.canWaiter) {
    return (
      <section className="salon-page">
        <h1>Salão</h1>
        <p>Sem permissão para mesas ou garçom.</p>
      </section>
    )
  }

  async function handleOpenTable(table: SalonTable) {
    try {
      const ticket = await salon.openOrGetTicket(table)
      setActiveTicket(ticket)
    } catch (err) {
      salon.setError(err instanceof Error ? err.message : 'Falha ao abrir mesa.')
    }
  }

  async function handleAdd(
    product: Parameters<typeof salon.addProductToTicket>[0]['product'],
    quantity: number,
    note?: string,
  ) {
    if (!activeTicket) return
    const updated = await salon.addProductToTicket({
      ticketId: activeTicket.id,
      product,
      quantity,
      note,
    })
    setActiveTicket(updated)
  }

  async function handleCloseConfirm(input: {
    payments: SalePayment[]
    discountCents: number
    note?: string
  }) {
    if (!activeTicket || !salon.organization || !salon.operator || !salon.user) {
      throw new Error('Sessão incompleta.')
    }
    if (!deviceId) throw new Error('Dispositivo não identificado.')

    const cash = await getOpenCashSession(salon.organization.id)
    if (!cash) {
      throw new Error('Abra o caixa antes de fechar a comanda.')
    }

    const items = activeTicket.items
      .filter((item) => item.prepStatus !== PREP_STATUSES.CANCELED)
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        costCents: item.costCents,
        quantity: item.quantity,
        type: item.type,
      }))

    if (items.length === 0) throw new Error('Comanda sem itens.')

    await salon.applyDiscount(activeTicket.id, input.discountCents)

    const sale = await completeSale({
      organizationId: salon.organization.id,
      items,
      discountCents: input.discountCents,
      payments: input.payments,
      soldByUserId: salon.user.id,
      soldByName: salon.operator.displayName,
      cashSessionId: cash.id,
      operatorId: salon.operator.id,
      deviceId,
      operatorRole: salon.operator.role,
      note: input.note,
    })

    await salon.closeTicketAfterSale(activeTicket.id, sale.id)
    try {
      const settings = resolveReceiptSettings({ organization: salon.organization })
      if (settings.printOnSale || settings.sendReceiptOnSale) {
        await fulfillSaleReceipt({
          organization: salon.organization,
          sale,
          settings,
        })
      }
    } catch {
      // cupom é best-effort
    }

    setToast(`Conta da ${activeTicket.tableName} fechada.`)
    setClosing(false)
    setActiveTicket(null)
  }

  async function handleCreateTable(event: FormEvent) {
    event.preventDefault()
    const number = Math.max(1, Number(newTableNumber) || nextNumber)
    const name = newTableName.trim() || `Mesa ${number}`
    try {
      await salon.addTable(name, number)
      setNewTableNumber('')
      setNewTableName('')
      setToast(`Mesa ${number} cadastrada.`)
    } catch (err) {
      salon.setError(err instanceof Error ? err.message : 'Não foi possível criar a mesa.')
    }
  }

  const liveTicket =
    activeTicket &&
    (salon.tickets.find((ticket) => ticket.id === activeTicket.id) ?? activeTicket)

  return (
    <section className="salon-page">
      <header className="salon-page__header">
        <div>
          <h1>Mesas</h1>
          <p>Cadastre as mesas reais do salão e abra comandas</p>
        </div>
        <div className="salon-page__links">
          {salon.canWaiter && <Link to="/app/salon/waiter">Garçom</Link>}
          {salon.canKitchen && <Link to="/app/salon/kitchen">Cozinha</Link>}
        </div>
      </header>

      {salon.error && <p className="salon-ticket__error">{salon.error}</p>}
      {toast && <p className="salon-page__toast">{toast}</p>}

      {salon.loading ? (
        <p>Carregando mesas…</p>
      ) : liveTicket ? (
        <TicketPanel
          ticket={liveTicket}
          products={salon.products}
          busy={salon.busy}
          canAdd={salon.canWaiter || salon.canTables}
          canClose={salon.canClose}
          onBack={() => {
            setActiveTicket(null)
          }}
          onAddProduct={handleAdd}
          onRemoveItem={async (itemId) => {
            const updated = await salon.removeTicketItem(liveTicket.id, itemId)
            if (updated) setActiveTicket(updated)
          }}
          onCloseRequest={() => setClosing(true)}
          onVoidEmpty={() => {
            void salon.voidEmptyTicket(liveTicket.id).then(() => {
              setActiveTicket(null)
            })
          }}
        />
      ) : (
        <>
          {activeTables.length === 0 ? (
            <p className="salon-page__empty">
              Nenhuma mesa cadastrada. Adicione as mesas reais do seu estabelecimento abaixo.
            </p>
          ) : (
            <div className="salon-map">
              {activeTables.map((table) => {
                const ticket = salon.ticketByTableId.get(table.id)
                const occupied = Boolean(ticket)
                return (
                  <div key={table.id} className="salon-map__card">
                    <button
                      type="button"
                      className={
                        occupied
                          ? 'salon-map__table salon-map__table--busy'
                          : 'salon-map__table'
                      }
                      disabled={salon.busy}
                      onClick={() => void handleOpenTable(table)}
                    >
                      <strong>{table.name}</strong>
                      {ticket ? (
                        <>
                          <span>{ticketItemCount(ticket.items)} itens</span>
                          <em>{formatMoney(ticketTotalCents(ticket))}</em>
                        </>
                      ) : (
                        <span>Livre</span>
                      )}
                    </button>
                    {salon.canTables && !occupied && (
                      <button
                        type="button"
                        className="salon-map__remove"
                        disabled={salon.busy}
                        onClick={() => void salon.toggleTableActive(table)}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {salon.canTables && activeTables.length > 0 && (
            <button
              type="button"
              className="salon-page__clear-tables"
              disabled={salon.busy}
              onClick={() => {
                const free = activeTables.filter((table) => !salon.ticketByTableId.has(table.id))
                if (free.length === 0) {
                  setToast('Não há mesas livres para remover.')
                  return
                }
                const ok = window.confirm(
                  `Remover ${free.length} mesa(s) livre(s)? Você poderá cadastrar de novo as mesas reais.`,
                )
                if (!ok) return
                void (async () => {
                  for (const table of free) {
                    await salon.toggleTableActive(table)
                  }
                  setToast('Mesas livres removidas. Cadastre as mesas reais.')
                })()
              }}
            >
              Remover mesas livres
            </button>
          )}

          {salon.canTables && (
            <form className="salon-page__add-table" onSubmit={(e) => void handleCreateTable(e)}>
              <h3>Cadastrar mesa</h3>
              <input
                type="text"
                placeholder="Nome (ex.: Mesa 1, Varanda)"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
              />
              <input
                type="number"
                min={1}
                placeholder={`Nº (próximo: ${nextNumber})`}
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
              />
              <button type="submit" disabled={salon.busy}>
                Adicionar
              </button>
            </form>
          )}
        </>
      )}

      {closing && liveTicket && (
        <CloseTicketModal
          ticket={liveTicket}
          busy={salon.busy}
          onCancel={() => setClosing(false)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </section>
  )
}
