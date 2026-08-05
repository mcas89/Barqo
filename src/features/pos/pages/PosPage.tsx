import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { BALQO_LOGO_SRC } from '../../../shared/constants'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { PinAuthorizeModal } from '../components/PinAuthorizeModal'
import { PosCustomerPicker } from '../components/PosCustomerPicker'
import { PosUnlockScreen } from '../components/PosUnlockScreen'
import { usePos } from '../hooks/usePos'
import { usePosOperator } from '../hooks/usePosOperator'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '../types'
import './PosPage.css'

type PendingAuth =
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | null

export function PosPage() {
  const searchRef = useRef<HTMLInputElement>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [openingValue, setOpeningValue] = useState('0,00')
  const [toast, setToast] = useState<string | null>(null)
  const [pendingAuth, setPendingAuth] = useState<PendingAuth>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)

  const { subscription, organization: authOrg } = useAuth()
  const planId =
    subscription?.planId ?? authOrg?.planId ?? DEFAULT_PLAN_ID
  const canUseFiado = planHasFeature(planId, PLAN_FEATURES.RECEIVABLES)

  const {
    operator,
    loading: loadingOperator,
    lock,
    authorizePrivileged,
    canRemoveCartItem,
    canAccessBackOffice,
    pinRequired,
  } = usePosOperator()

  const {
    organization,
    loadingCatalog,
    loadingCash,
    cashOpen,
    cashSession,
    catalog,
    search,
    setSearch,
    filteredCatalog,
    cart,
    discountCents,
    setDiscountCents,
    totalCents,
    busy,
    error,
    lastSale,
    clearLastSale,
    customer,
    setCustomer,
    addProduct,
    addBySearchEnter,
    setItemQuantity,
    removeItem,
    clearCart,
    payFullWith,
    setPaymentAmount,
    finishSale,
    openCash,
    payments,
  } = usePos()

  const paymentMethods = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).filter(
    (method) =>
      method !== PAYMENT_METHODS.ON_ACCOUNT || (canUseFiado && Boolean(customer)),
  )

  const showSuggestions = cashOpen && search.trim().length > 0 && !busy
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    if (cashOpen && operator) searchRef.current?.focus()
  }, [cashOpen, toast, operator])

  useEffect(() => {
    if (!lastSale) return
    setToast(
      lastSale.changeCents > 0
        ? `Venda concluída · Troco ${formatMoney(lastSale.changeCents)}`
        : 'Venda concluída',
    )
    clearLastSale()
  }, [lastSale, clearLastSale])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleOpenCash(event: FormEvent) {
    event.preventDefault()
    try {
      await openCash(parseMoneyToCents(openingValue))
      setOpeningValue('0,00')
      setToast('Caixa aberto')
    } catch {
      // mensagem no hook
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addBySearchEnter()
      searchRef.current?.focus()
    }
    if (event.key === 'Escape') {
      setSearch('')
    }
  }

  function pickProduct(productId: string) {
    const product = catalog.find((item) => item.id === productId)
    if (!product) return
    addProduct(product)
    setSearch('')
    searchRef.current?.focus()
  }

  function choosePayment(method: PaymentMethod) {
    setSelectedMethod(method)
    if (method === 'cash') {
      const received = cashReceived
        ? parseMoneyToCents(cashReceived)
        : totalCents
      setPaymentAmount('cash', Math.max(received, totalCents))
      if (!cashReceived) {
        setCashReceived((totalCents / 100).toFixed(2).replace('.', ','))
      }
    } else {
      setCashReceived('')
      payFullWith(method)
    }
  }

  function onCashReceivedChange(value: string) {
    setCashReceived(value)
    const received = parseMoneyToCents(value)
    if (received > 0) {
      setPaymentAmount('cash', received)
    }
  }

  async function handleFinish() {
    if (!activeMethod) return

    const payment =
      activeMethod === 'cash'
        ? [
            {
              method: 'cash' as const,
              amountCents: Math.max(parseMoneyToCents(cashReceived), totalCents),
            },
          ]
        : [{ method: activeMethod, amountCents: totalCents }]

    await finishSale(payment)
    setSelectedMethod(null)
    setCashReceived('')
    setShowDiscount(false)
    searchRef.current?.focus()
  }

  function requestRemove(productId: string) {
    if (canRemoveCartItem) {
      removeItem(productId)
      return
    }
    setPendingAuth({ type: 'remove', productId })
  }

  function requestClear() {
    if (canRemoveCartItem) {
      clearCart()
      return
    }
    setPendingAuth({ type: 'clear' })
  }

  async function handleAuthorize(pin: string) {
    if (!pendingAuth) return
    setAuthBusy(true)
    try {
      await authorizePrivileged(pin)
      if (pendingAuth.type === 'remove') {
        removeItem(pendingAuth.productId)
      } else {
        clearCart()
      }
      setPendingAuth(null)
    } finally {
      setAuthBusy(false)
    }
  }

  if (!organization) {
    return <p className="pos-page__empty">Nenhuma loja ativa.</p>
  }

  if (loadingOperator) {
    return <p className="pos-page__empty">Preparando PDV…</p>
  }

  if (!operator) {
    return <PosUnlockScreen />
  }

  if (loadingCash) {
    return <p className="pos-page__empty">Verificando caixa…</p>
  }

  if (!cashOpen) {
    return (
      <section className="pos-page pos-page--centered">
        {error && (
          <p className="pos-page__error" role="alert">
            {error}
          </p>
        )}
        <form className="pos-page__cash-gate" onSubmit={handleOpenCash}>
          <div className="pos-page__gate-brand">
            <img src={organization.logoDataUrl || BALQO_LOGO_SRC} alt={organization.name} />
          </div>
          <p className="pos-page__eyebrow">{organization.name}</p>
          <h1>Caixa fechado</h1>
          <p>
            Abra o turno com o valor que está na gaveta para começar a vender.
          </p>
          <label>
            Valor inicial (R$)
            <input
              value={openingValue}
              onChange={(e) => setOpeningValue(e.target.value)}
              disabled={busy}
              placeholder="0,00"
              autoFocus
            />
          </label>
          <button type="submit" className="pos-page__finish" disabled={busy}>
            {busy ? 'Abrindo…' : 'Abrir caixa e vender'}
          </button>
          <div className="pos-page__gate-actions">
            {pinRequired && (
              <button type="button" className="pos-page__text-btn" onClick={lock}>
                Trocar operador
              </button>
            )}
            {canAccessBackOffice && (
              <Link to="/app/cash" className="pos-page__cash-link">
                Ir para a tela de Caixa
              </Link>
            )}
          </div>
        </form>
      </section>
    )
  }

  const paidMethod = payments[0]?.method
  const activeMethod = selectedMethod ?? paidMethod ?? null
  const cashReady =
    activeMethod !== 'cash' || parseMoneyToCents(cashReceived) >= totalCents
  const fiadoReady =
    activeMethod !== PAYMENT_METHODS.ON_ACCOUNT || Boolean(customer)
  const canFinish =
    cart.length > 0 &&
    Boolean(activeMethod) &&
    cashReady &&
    fiadoReady &&
    !busy

  return (
    <section className="pos-page">
      <div className="pos-page__toolbar">
        <div className="pos-page__search-wrap">
          <input
            ref={searchRef}
            className="pos-page__search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Código de barras ou nome do produto"
            disabled={busy}
            aria-label="Buscar produto"
            autoComplete="off"
          />

          {showSuggestions && (
            <ul className="pos-page__suggest" role="listbox">
              {loadingCatalog ? (
                <li className="pos-page__suggest-empty">Carregando…</li>
              ) : filteredCatalog.length === 0 ? (
                <li className="pos-page__suggest-empty">Nenhum produto encontrado</li>
              ) : (
                filteredCatalog.slice(0, 8).map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => pickProduct(product.id)}
                      disabled={product.type === 'product' && product.stock <= 0}
                    >
                      <span>
                        {product.name}
                        {product.barcode ? <em>{product.barcode}</em> : null}
                      </span>
                      <strong>{formatMoney(product.priceCents)}</strong>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="pos-page__customer-chip"
          title="Cliente da venda"
          onClick={() => setShowCustomerPicker(true)}
        >
          {customer ? customer.name : 'Cliente'}
        </button>

        <div className="pos-page__cash-pill" title={cashSession?.openedByName}>
          Caixa aberto
        </div>

        {pinRequired && (
          <button type="button" className="pos-page__ghost" onClick={lock}>
            Trocar
          </button>
        )}
        {canAccessBackOffice && (
          <Link to="/app/cash" className="pos-page__ghost pos-page__ghost-link">
            Caixa
          </Link>
        )}
      </div>

      <div className="pos-page__body">
      {toast && (
        <div className="pos-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {pendingAuth && (
        <PinAuthorizeModal
          title={
            pendingAuth?.type === 'clear' ? 'Limpar carrinho' : 'Remover item'
          }
          description="Só proprietário ou gerente pode excluir itens. Digite o PIN para autorizar."
          busy={authBusy}
          onConfirm={handleAuthorize}
          onCancel={() => setPendingAuth(null)}
        />
      )}

      {showCustomerPicker && (
        <PosCustomerPicker
          currentId={customer?.id}
          onSelect={(next) => {
            setCustomer(next)
            if (!next) {
              setSelectedMethod((current) =>
                current === PAYMENT_METHODS.ON_ACCOUNT ? null : current,
              )
              setPaymentAmount(PAYMENT_METHODS.ON_ACCOUNT, 0)
            }
          }}
          onClose={() => setShowCustomerPicker(false)}
        />
      )}

      {error && (
        <p className="pos-page__error" role="alert">
          {error}
        </p>
      )}

      <div className="pos-page__stage">
        <div className="pos-page__cart-panel">
          <header className="pos-page__cart-header">
            <div>
              {cart.length > 0 && (
                <p className="pos-page__sale-mode">
                  {customer ? customer.name : 'Caixa livre'}
                </p>
              )}
              <span>
                {itemCount === 0 ? 'Nenhum item ainda' : `${itemCount} item(ns)`}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                className="pos-page__ghost"
                onClick={requestClear}
                disabled={busy}
              >
                Limpar
              </button>
            )}
          </header>

          {cart.length === 0 ? (
            <div className="pos-page__empty-cart">
              <strong className="pos-page__empty-mode">
                {customer ? customer.name : 'Caixa livre'}
              </strong>
              <p>Passe o código ou busque pelo nome. Os itens entram aqui.</p>
            </div>
          ) : (
            <ul className="pos-page__cart-list">
              {cart.map((item) => (
                <li key={item.productId}>
                  <div className="pos-page__item-info">
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.unitPriceCents)} cada</span>
                  </div>
                  <div className="pos-page__qty">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() => {
                        if (item.quantity <= 1) {
                          requestRemove(item.productId)
                          return
                        }
                        setItemQuantity(item.productId, item.quantity - 1)
                      }}
                      disabled={busy}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() => setItemQuantity(item.productId, item.quantity + 1)}
                      disabled={busy}
                    >
                      +
                    </button>
                  </div>
                  <div className="pos-page__line-total">
                    <strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong>
                    <button
                      type="button"
                      className="pos-page__ghost"
                      onClick={() => requestRemove(item.productId)}
                      disabled={busy}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="pos-page__checkout">
          <div className="pos-page__total-block">
            <span>Total da venda</span>
            <strong>{formatMoney(totalCents)}</strong>
            {discountCents > 0 && (
              <em>Desconto {formatMoney(discountCents)}</em>
            )}
          </div>

          <button
            type="button"
            className="pos-page__ghost pos-page__discount-toggle"
            onClick={() => setShowDiscount((value) => !value)}
            disabled={busy || cart.length === 0}
          >
            {showDiscount ? 'Ocultar desconto' : 'Desconto'}
          </button>

          {showDiscount && (
            <label className="pos-page__discount">
              Valor do desconto
              <input
                value={
                  discountCents ? (discountCents / 100).toFixed(2).replace('.', ',') : ''
                }
                onChange={(e) => setDiscountCents(parseMoneyToCents(e.target.value))}
                placeholder="0,00"
                disabled={busy}
              />
            </label>
          )}

          <p className="pos-page__pay-label">Forma de pagamento</p>
          <div className="pos-page__pay-grid">
            {paymentMethods.map((method) => (
              <button
                key={method}
                type="button"
                className={
                  activeMethod === method
                    ? 'pos-page__pay-btn pos-page__pay-btn--active'
                    : 'pos-page__pay-btn'
                }
                onClick={() => choosePayment(method)}
                disabled={busy || totalCents <= 0}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            ))}
          </div>

          {activeMethod === 'cash' && (
            <label className="pos-page__cash">
              Valor recebido
              <input
                value={cashReceived}
                onChange={(e) => onCashReceivedChange(e.target.value)}
                placeholder="0,00"
                disabled={busy}
              />
            </label>
          )}

          {activeMethod === 'cash' &&
            parseMoneyToCents(cashReceived) >= totalCents &&
            parseMoneyToCents(cashReceived) - totalCents > 0 && (
            <div className="pos-page__change">
              <span>Troco</span>
              <strong>{formatMoney(parseMoneyToCents(cashReceived) - totalCents)}</strong>
            </div>
          )}

          <button
            type="button"
            className="pos-page__finish"
            onClick={() => void handleFinish()}
            disabled={!canFinish}
          >
            {busy ? 'Finalizando…' : 'Finalizar venda'}
          </button>
        </aside>
      </div>
      </div>
    </section>
  )
}
