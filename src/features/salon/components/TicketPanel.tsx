import { useMemo, useState, type FormEvent } from 'react'
import { formatMoney } from '../../../shared/lib/money'
import { findProductByBarcode, type Product } from '../../products'
import {
  PREP_STATUS_LABELS,
  PREP_STATUSES,
  ticketItemCount,
  ticketTotalCents,
  type SalonTicket,
} from '../types'
import './../pages/SalonShared.css'

export type OrderCartLine = {
  key: string
  product: Product
  quantity: number
  note?: string
}

interface TicketPanelProps {
  ticket: SalonTicket
  products: Product[]
  busy?: boolean
  canAdd?: boolean
  canClose?: boolean
  /** Entrada por carrinho local + Pedir em lote (garçom). */
  orderEntry?: boolean
  onAddProduct?: (product: Product, quantity: number, note?: string) => Promise<void>
  /** Envia o carrinho completo à cozinha de uma vez. */
  onSendOrder?: (lines: Array<{ product: Product; quantity: number; note?: string }>) => Promise<void>
  onRemoveItem?: (itemId: string) => Promise<void>
  onCloseRequest?: () => void
  onVoidEmpty?: () => void
  onBack?: () => void
}

function resolveProduct(products: Product[], query: string): Product | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const byCode = findProductByBarcode(products, q)
  if (byCode) return byCode
  const exactName = products.find((product) => product.name.toLowerCase() === q)
  if (exactName) return exactName
  const matches = products.filter(
    (product) =>
      product.name.toLowerCase().includes(q) ||
      product.barcode?.toLowerCase().includes(q),
  )
  if (matches.length === 1) return matches[0]
  return null
}

function filterProducts(products: Product[], query: string, limit = 40): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return products.slice(0, limit)
  return products
    .filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.barcode?.toLowerCase().includes(q),
    )
    .slice(0, limit)
}

function cartLineKey(productId: string, note?: string) {
  return `${productId}::${(note ?? '').trim().toLowerCase()}`
}

export function TicketPanel({
  ticket,
  products,
  busy,
  canAdd = true,
  canClose = true,
  orderEntry = false,
  onAddProduct,
  onSendOrder,
  onRemoveItem,
  onCloseRequest,
  onVoidEmpty,
  onBack,
}: TicketPanelProps) {
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState<Product | null>(null)
  const [cart, setCart] = useState<OrderCartLine[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    if (!orderEntry || !search.trim() || selected) return []
    return filterProducts(products, search, 8)
  }, [orderEntry, products, search, selected])

  const matched = selected ?? (orderEntry && search.trim() ? resolveProduct(products, search) : null)

  const filtered = useMemo(() => {
    if (orderEntry) return []
    return filterProducts(products, search, 40)
  }, [orderEntry, products, search])

  const total = ticketTotalCents(ticket)
  const count = ticketItemCount(ticket.items)
  const activeItems = ticket.items.filter(
    (item) => item.prepStatus !== PREP_STATUSES.CANCELED,
  )

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const cartTotalCents = cart.reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0,
  )

  function bumpQty(delta: number) {
    setQty((current) => Math.max(1, current + delta))
  }

  function pickSuggestion(product: Product) {
    setLocalError(null)
    setSelected(product)
    setSearch(product.name)
  }

  function onSearchChange(value: string) {
    setSearch(value)
    setSelected(null)
    setLocalError(null)
  }

  function resetPicker() {
    setNote('')
    setQty(1)
    setSearch('')
    setSelected(null)
  }

  function addToCart(event?: FormEvent) {
    event?.preventDefault()
    setLocalError(null)
    const product = selected ?? resolveProduct(products, search)
    if (!product) {
      setLocalError(
        search.trim()
          ? suggestions.length > 0
            ? 'Toque no item da lista para selecionar.'
            : 'Produto não encontrado. Digite o código ou o nome.'
          : 'Informe o item ou o código.',
      )
      return
    }
    const trimmedNote = note.trim() || undefined
    const key = cartLineKey(product.id, trimmedNote)
    setCart((current) => {
      const existing = current.find((line) => line.key === key)
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + qty } : line,
        )
      }
      return [
        ...current,
        {
          key,
          product,
          quantity: qty,
          note: trimmedNote,
        },
      ]
    })
    resetPicker()
  }

  function removeFromCart(key: string) {
    setCart((current) => current.filter((line) => line.key !== key))
  }

  function bumpCartQty(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    )
  }

  async function sendOrder() {
    if (!onSendOrder) return
    if (cart.length === 0) {
      setLocalError('Adicione itens ao pedido antes de enviar à cozinha.')
      return
    }
    setLocalError(null)
    try {
      await onSendOrder(
        cart.map((line) => ({
          product: line.product,
          quantity: line.quantity,
          note: line.note,
        })),
      )
      setCart([])
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Não foi possível pedir.')
    }
  }

  async function handleAdd(product: Product) {
    if (!onAddProduct) return
    setLocalError(null)
    try {
      await onAddProduct(product, qty, note.trim() || undefined)
      resetPicker()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Não foi possível adicionar.')
    }
  }

  async function handleRemove(itemId: string) {
    if (!onRemoveItem) return
    setLocalError(null)
    try {
      await onRemoveItem(itemId)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Não foi possível remover.')
    }
  }

  if (orderEntry) {
    return (
      <section className="waiter-ticket">
        <header className="waiter-ticket__bar">
          {onBack && (
            <button type="button" className="waiter-ticket__back" onClick={onBack}>
              ← Mesas
            </button>
          )}
          <div className="waiter-ticket__title">
            <h2>{ticket.tableName}</h2>
            <p>
              {count} na comanda · {formatMoney(total)}
            </p>
          </div>
          {canClose && onCloseRequest && activeItems.length > 0 && (
            <button
              type="button"
              className="waiter-ticket__close"
              disabled={busy}
              onClick={onCloseRequest}
            >
              Fechar conta
            </button>
          )}
        </header>

        {localError && <p className="salon-ticket__error">{localError}</p>}

        <div className="waiter-ticket__scroll">
          {cart.length > 0 && (
            <section className="waiter-cart">
              <header className="waiter-cart__head">
                <h3>Pedido atual</h3>
                <span>
                  {cartCount} · {formatMoney(cartTotalCents)}
                </span>
              </header>
              <ul className="waiter-cart__list">
                {cart.map((line) => (
                  <li key={line.key} className="waiter-cart__item">
                    <div className="waiter-cart__main">
                      <strong>{line.product.name}</strong>
                      {line.note ? <em>{line.note}</em> : null}
                      <span>{formatMoney(line.product.priceCents * line.quantity)}</span>
                    </div>
                    <div className="waiter-cart__controls">
                      <div className="waiter-order__qty waiter-order__qty--sm">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => bumpCartQty(line.key, -1)}
                          aria-label="Diminuir"
                        >
                          −
                        </button>
                        <strong>{line.quantity}</strong>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => bumpCartQty(line.key, 1)}
                          aria-label="Aumentar"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="waiter-ticket__remove"
                        disabled={busy}
                        onClick={() => removeFromCart(line.key)}
                      >
                        Tirar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="waiter-sent">
            <h3 className="waiter-sent__title">
              {activeItems.length === 0 ? 'Comanda' : 'Já na comanda'}
            </h3>
            <ul className="waiter-ticket__items">
              {activeItems.length === 0 ? (
                <li className="waiter-ticket__empty">
                  Monte o pedido abaixo e toque em Pedir para enviar à cozinha.
                </li>
              ) : (
                activeItems.map((item) => (
                  <li key={item.id} className="waiter-ticket__item">
                    <div className="waiter-ticket__item-main">
                      <strong>
                        {item.quantity}× {item.name}
                      </strong>
                      {item.note ? <em>{item.note}</em> : null}
                      <small>{PREP_STATUS_LABELS[item.prepStatus]}</small>
                    </div>
                    <div className="waiter-ticket__item-side">
                      <strong>{formatMoney(item.totalCents)}</strong>
                      {onRemoveItem && (
                        <button
                          type="button"
                          className="waiter-ticket__remove"
                          disabled={busy}
                          onClick={() => void handleRemove(item.id)}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        {canAdd && (
          <div className="waiter-order">
            <form className="waiter-order__form" onSubmit={(e) => addToCart(e)}>
              <div className="waiter-order__search">
                <label className="waiter-order__field">
                  <span>Item / código</span>
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Código ou nome do item"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={busy}
                    autoFocus
                  />
                </label>

                {suggestions.length > 0 && (
                  <ul className="waiter-order__suggestions" role="listbox">
                    {suggestions.map((product) => (
                      <li key={product.id} role="option">
                        <button
                          type="button"
                          disabled={busy}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            pickSuggestion(product)
                          }}
                        >
                          <span>
                            {product.name}
                            {product.barcode ? <em>{product.barcode}</em> : null}
                          </span>
                          <strong>{formatMoney(product.priceCents)}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {matched && suggestions.length === 0 && (
                  <p className="waiter-order__match">
                    {matched.name}
                    <span>{formatMoney(matched.priceCents)}</span>
                  </p>
                )}
              </div>

              <div className="waiter-order__row">
                <div className="waiter-order__qty" aria-label="Quantidade">
                  <button
                    type="button"
                    disabled={busy || qty <= 1}
                    onClick={() => bumpQty(-1)}
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <strong>{qty}</strong>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => bumpQty(1)}
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
                <label className="waiter-order__field waiter-order__field--grow">
                  <span>Obs.</span>
                  <input
                    type="text"
                    placeholder="Ex.: sem cebola"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>

              <button type="submit" className="waiter-order__add" disabled={busy}>
                Adicionar ao pedido
              </button>
            </form>

            <button
              type="button"
              className="waiter-order__submit"
              disabled={busy || cart.length === 0}
              onClick={() => void sendOrder()}
            >
              {cart.length === 0
                ? 'Pedir · enviar à cozinha'
                : `Pedir · enviar ${cartCount} à cozinha`}
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="salon-ticket">
      <header className="salon-ticket__header">
        <div>
          {onBack && (
            <button type="button" className="salon-ticket__back" onClick={onBack}>
              ← Voltar
            </button>
          )}
          <h2>{ticket.tableName}</h2>
          <p>
            {count} item(ns) · {formatMoney(total)}
          </p>
        </div>
        <div className="salon-ticket__header-actions">
          {canClose && onCloseRequest && activeItems.length > 0 && (
            <button
              type="button"
              className="salon-ticket__primary"
              disabled={busy}
              onClick={onCloseRequest}
            >
              Fechar conta
            </button>
          )}
          {onVoidEmpty && activeItems.length === 0 && (
            <button type="button" disabled={busy} onClick={onVoidEmpty}>
              Liberar mesa
            </button>
          )}
        </div>
      </header>

      {localError && <p className="salon-ticket__error">{localError}</p>}

      <ul className="salon-ticket__items">
        {activeItems.length === 0 ? (
          <li className="salon-ticket__empty">Nenhum item ainda.</li>
        ) : (
          activeItems.map((item) => (
            <li key={item.id}>
              <span>
                <strong>
                  {item.quantity}× {item.name}
                </strong>
                {item.note ? <em>{item.note}</em> : null}
                <small>{PREP_STATUS_LABELS[item.prepStatus]}</small>
              </span>
              <div className="salon-ticket__item-side">
                <strong>{formatMoney(item.totalCents)}</strong>
                {onRemoveItem && (
                  <button
                    type="button"
                    className="salon-ticket__remove"
                    disabled={busy}
                    onClick={() => void handleRemove(item.id)}
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      {canAdd && (
        <div className="salon-ticket__add">
          <h3>Adicionar item</h3>
          <div className="salon-ticket__add-row">
            <input
              type="search"
              placeholder="Buscar produto ou código"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy}
            />
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              disabled={busy}
              aria-label="Quantidade"
            />
          </div>
          <input
            type="text"
            placeholder="Observação (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
          <ul className="salon-ticket__catalog">
            {filtered.map((product) => (
              <li key={product.id}>
                <button type="button" disabled={busy} onClick={() => void handleAdd(product)}>
                  <span>
                    {product.name}
                    <em>{formatMoney(product.priceCents)}</em>
                  </span>
                  <strong>+</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
