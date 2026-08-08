import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  EllipsisVertical,
  Pause,
  Play,
  Receipt,
  ScanLine,
  Search,
  Tag,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { BALQO_LOGO_SRC } from '../../../shared/constants'
import { startOfLocalDayIso } from '../../../shared/lib/dates'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import { listSalesSince } from '../../cash-register'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
} from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { fulfillSaleReceipt, resolveReceiptSettings, WhatsappReceiptSheet } from '../../receipts'
import { PinAuthorizeModal } from '../components/PinAuthorizeModal'
import { PosBarcodeScanner } from '../components/PosBarcodeScanner'
import { PosCustomerPicker } from '../components/PosCustomerPicker'
import { PosQuickItemPanel, type QuickItemMode } from '../components/PosQuickItemPanel'
import { PosRemainingPaymentModal } from '../components/PosRemainingPaymentModal'
import { PosRecentSalesPanel } from '../components/PosRecentSalesPanel'
import { PosUnlockScreen } from '../components/PosUnlockScreen'
import { usePos } from '../hooks/usePos'
import { usePosOperator } from '../hooks/usePosOperator'
import { PERMISSIONS } from '../../users/permissions'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  type Sale,
  type SalePayment,
} from '../types'
import './PosPage.css'

type PendingAuth =
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | null

export function PosPage() {
  const searchRef = useRef<HTMLInputElement>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [paymentAmountDraft, setPaymentAmountDraft] = useState('')
  const [splitPayments, setSplitPayments] = useState<SalePayment[] | null>(null)
  const [openingValue, setOpeningValue] = useState('0,00')
  const [toast, setToast] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [pendingAuth, setPendingAuth] = useState<PendingAuth>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showRecentSales, setShowRecentSales] = useState(false)
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [loadingRecentSales, setLoadingRecentSales] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickMode, setQuickMode] = useState<QuickItemMode>('register')
  const [quickName, setQuickName] = useState('')
  const [quickBarcode, setQuickBarcode] = useState('')
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [showMobileMore, setShowMobileMore] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [whatsappReceipt, setWhatsappReceipt] = useState<{
    sale: Sale
    phone?: string
    copy?: 'original' | 'segunda_via'
  } | null>(null)

  const { subscription, organization: authOrg } = useAuth()
  const { devices, deviceId } = useDeviceSession()
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
    can,
    pinRequired,
  } = usePosOperator()

  const canOpenFiados =
    canUseFiado &&
    (canAccessBackOffice || can(PERMISSIONS.MANAGE_RECEIVABLES))

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
    addByBarcode,
    addLooseItem,
    quickCreateAndAdd,
    setItemQuantity,
    setItemPrice,
    removeItem,
    clearCart,
    setPaymentAmount,
    payFullWith,
    finishSale,
    openCash,
    payments,
    changeCents,
    holdSale,
    resumeHeldSale,
    discardHeld,
    heldSales,
    maxHeldSales,
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
    setCompletedSale(lastSale)
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

  async function openRecentSales() {
    setShowRecentSales(true)
    if (!organization) return
    setLoadingRecentSales(true)
    try {
      const sales = await listSalesSince(organization.id, startOfLocalDayIso())
      const latest = [...sales].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )
      if (completedSale && !latest.some((sale) => sale.id === completedSale.id)) {
        latest.unshift(completedSale)
      }
      setRecentSales(latest.slice(0, 5))
    } catch (err) {
      console.error(err)
      setRecentSales(completedSale ? [completedSale] : [])
    } finally {
      setLoadingRecentSales(false)
    }
  }

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

  function looksLikeBarcode(value: string) {
    return /^\d{6,}$/.test(value.trim())
  }

  function openQuick(mode: QuickItemMode, fromSearch = false) {
    const term = search.trim()
    if (fromSearch && looksLikeBarcode(term)) {
      setQuickBarcode(term)
      setQuickName('')
    } else {
      setQuickBarcode('')
      setQuickName(term.toLocaleUpperCase('pt-BR'))
    }
    setQuickMode(mode)
    setQuickOpen(true)
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const result = addBySearchEnter()
      if (result === 'not_found') {
        openQuick(looksLikeBarcode(search) ? 'register' : 'loose', true)
      }
      searchRef.current?.focus()
    }
    if (event.key === 'Escape') {
      setSearch('')
    }
  }

  function handleBarcodeDetect(code: string) {
    setShowBarcodeScanner(false)
    const result = addByBarcode(code)
    if (result === 'added') {
      setToast('Produto adicionado')
      return
    }
    if (result === 'not_found') {
      setSearch(code)
      setQuickBarcode(code)
      setQuickName('')
      setQuickMode('register')
      setQuickOpen(true)
      setToast('Código não cadastrado')
      return
    }
    setToast('Abra o caixa para vender')
  }

  function startPriceEdit(productId: string, unitPriceCents: number) {
    setEditingPriceId(productId)
    setPriceDraft((unitPriceCents / 100).toFixed(2).replace('.', ','))
  }

  function commitPriceEdit(productId: string) {
    setItemPrice(productId, parseMoneyToCents(priceDraft))
    setEditingPriceId(null)
  }

  function pickProduct(productId: string) {
    const product = catalog.find((item) => item.id === productId)
    if (!product) return
    addProduct(product)
    setSearch('')
    searchRef.current?.focus()
  }

  function centsToInput(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',')
  }

  function choosePayment(method: PaymentMethod) {
    if (totalCents <= 0) return
    setSelectedMethod(method)
    setSplitPayments(null)
    const draft = centsToInput(totalCents)
    setPaymentAmountDraft(draft)
    payFullWith(method)
  }

  function onPaymentAmountChange(value: string) {
    setPaymentAmountDraft(value)
    if (!selectedMethod) return
    let amount = parseMoneyToCents(value)
    if (selectedMethod !== PAYMENT_METHODS.CASH && amount > totalCents) {
      amount = totalCents
    }
    setPaymentAmount(selectedMethod, amount)
  }

  function paymentsTotal(list: SalePayment[]) {
    return list.reduce((sum, payment) => sum + payment.amountCents, 0)
  }

  function buildPrimaryPayments(): SalePayment[] | null {
    if (!selectedMethod) return null
    let amount = parseMoneyToCents(paymentAmountDraft)
    if (amount <= 0) return null
    if (selectedMethod !== PAYMENT_METHODS.CASH && amount > totalCents) {
      amount = totalCents
    }
    return [{ method: selectedMethod, amountCents: amount }]
  }

  async function completeSaleWithPayments(finalPayments: SalePayment[]) {
    const hasFiado = finalPayments.some(
      (payment) => payment.method === PAYMENT_METHODS.ON_ACCOUNT,
    )
    if (hasFiado && !customer) return

    const customerPhoneSnapshot = customer?.phone
    const sale = await finishSale(finalPayments)
    if (!sale || !organization) return

    setSplitPayments(null)
    setCompletedSale(sale)
    setRecentSales((current) =>
      [sale, ...current.filter((item) => item.id !== sale.id)].slice(0, 5),
    )
    setSelectedMethod(null)
    setPaymentAmountDraft('')
    setShowDiscount(false)
    searchRef.current?.focus()

    const devicePrinterPath = devices.find((device) => device.id === deviceId)?.printerPath
    const settings = resolveReceiptSettings({
      organization,
      devicePrinterPath,
    })
    if (settings.printOnSale || settings.sendReceiptOnSale) {
      void fulfillSaleReceipt({ sale, organization, settings }).catch((err) => {
        console.error(err)
      })
    }
    if (settings.offerWhatsappReceiptOnSale) {
      setWhatsappReceipt({
        sale,
        phone: customerPhoneSnapshot || sale.customerPhone,
        copy: 'original',
      })
    }
  }

  async function handleFinish() {
    const primary = buildPrimaryPayments()
    if (!primary) return

    const paid = paymentsTotal(primary)
    if (paid < totalCents) {
      setSplitPayments(primary)
      return
    }

    await completeSaleWithPayments(primary)
  }

  async function handleSplitConfirm(nextPayments: SalePayment[]) {
    const paid = paymentsTotal(nextPayments)
    if (paid < totalCents) {
      setSplitPayments(nextPayments)
      return
    }
    await completeSaleWithPayments(nextPayments)
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

  async function handleHoldSale() {
    if (cart.length === 0) return
    const label = window.prompt(
      'Nome da espera (opcional)\nEx.: João, mesa 2, retirou depois',
      customer?.name ?? '',
    )
    if (label === null) return
    const held = await holdSale(label.trim() || undefined)
    if (held) {
      setToast(`Venda em espera · ${held.label}`)
      setSelectedMethod(null)
      setPaymentAmountDraft('')
      setSplitPayments(null)
      setShowDiscount(false)
      searchRef.current?.focus()
    }
  }

  async function handleResumeHeld(heldId: string) {
    const ok = await resumeHeldSale(heldId)
    if (ok) {
      setSelectedMethod(null)
      setPaymentAmountDraft('')
      setSplitPayments(null)
      setShowDiscount(false)
      setToast('Venda retomada')
      searchRef.current?.focus()
    }
  }

  async function handleDiscardHeld(heldId: string) {
    const ok = window.confirm('Descartar esta venda em espera? Os itens serão perdidos.')
    if (!ok) return
    await discardHeld(heldId)
    setToast('Espera descartada')
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
  const paymentReady = parseMoneyToCents(paymentAmountDraft) > 0
  const fiadoReady =
    activeMethod !== PAYMENT_METHODS.ON_ACCOUNT || Boolean(customer)
  const canFinish =
    cart.length > 0 &&
    Boolean(activeMethod) &&
    totalCents > 0 &&
    paymentReady &&
    fiadoReady &&
    !busy

  return (
    <section className="pos-page">
      <div className="pos-page__toolbar">
        <div className="pos-page__search-wrap">
          <Search
            className="pos-page__search-icon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
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

          <button
            type="button"
            className="pos-page__scan-btn"
            title="Ler código com a câmera"
            aria-label="Ler código com a câmera"
            disabled={busy}
            onClick={() => setShowBarcodeScanner(true)}
          >
            <ScanLine size={20} strokeWidth={2} aria-hidden />
          </button>

          {showSuggestions && (
            <ul className="pos-page__suggest" role="listbox">
              {loadingCatalog ? (
                <li className="pos-page__suggest-empty">Carregando…</li>
              ) : filteredCatalog.length === 0 ? (
                <li className="pos-page__suggest-empty">
                  <span>Nenhum produto encontrado</span>
                  <div className="pos-page__suggest-actions">
                    <button type="button" onClick={() => openQuick('register', true)}>
                      Cadastrar
                    </button>
                    <button type="button" onClick={() => openQuick('loose', true)}>
                      Venda avulsa
                    </button>
                  </div>
                </li>
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
          className="pos-page__customer-chip pos-page__desk-only"
          title="Cliente da venda"
          onClick={() => setShowCustomerPicker(true)}
        >
          <UserRound size={16} strokeWidth={2} aria-hidden />
          {customer ? customer.name : 'Cliente'}
        </button>

        {canOpenFiados ? (
          <Link
            to="/app/receivables"
            className="pos-page__cash-pill pos-page__cash-pill--link pos-page__desk-only"
            title="Receber fiados"
          >
            <Wallet size={16} strokeWidth={2} aria-hidden />
            Fiados
          </Link>
        ) : (
          <div
            className="pos-page__cash-pill pos-page__desk-only"
            title={cashSession?.openedByName}
          >
            <Banknote size={16} strokeWidth={2} aria-hidden />
            Caixa aberto
          </div>
        )}

        <button
          type="button"
          className="pos-page__ghost pos-page__desk-only"
          onClick={() => openQuick('loose')}
        >
          <Tag size={16} strokeWidth={2} aria-hidden />
          Avulsa
        </button>
        <button
          type="button"
          className="pos-page__ghost pos-page__desk-only"
          onClick={() => void openRecentSales()}
        >
          <Receipt size={16} strokeWidth={2} aria-hidden />
          2ª via
        </button>
        {canAccessBackOffice && (
          <Link
            to="/app/cash"
            className="pos-page__ghost pos-page__ghost-link pos-page__desk-only"
          >
            <Banknote size={16} strokeWidth={2} aria-hidden />
            Caixa
          </Link>
        )}

        <div className="pos-page__more pos-page__phone-only">
          <button
            type="button"
            className="pos-page__ghost pos-page__more-btn"
            aria-expanded={showMobileMore}
            aria-haspopup="menu"
            aria-label="Mais opções"
            onClick={() => setShowMobileMore((open) => !open)}
          >
            <EllipsisVertical size={18} strokeWidth={2} aria-hidden />
          </button>
          {showMobileMore && (
            <>
              <button
                type="button"
                className="pos-page__more-backdrop"
                aria-label="Fechar menu"
                onClick={() => setShowMobileMore(false)}
              />
              <ul className="pos-page__more-menu" role="menu">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMobileMore(false)
                      setShowCustomerPicker(true)
                    }}
                  >
                    <UserRound size={16} strokeWidth={2} aria-hidden />
                    {customer ? `Cliente · ${customer.name}` : 'Cliente'}
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setShowMobileMore(false)
                      setShowBarcodeScanner(true)
                    }}
                  >
                    <ScanLine size={16} strokeWidth={2} aria-hidden />
                    Ler código
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMobileMore(false)
                      openQuick('loose')
                    }}
                  >
                    <Tag size={16} strokeWidth={2} aria-hidden />
                    Venda avulsa
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMobileMore(false)
                      void openRecentSales()
                    }}
                  >
                    <Receipt size={16} strokeWidth={2} aria-hidden />
                    2ª via
                  </button>
                </li>
                {canOpenFiados && (
                  <li role="none">
                    <Link
                      to="/app/receivables"
                      role="menuitem"
                      onClick={() => setShowMobileMore(false)}
                    >
                      <Wallet size={16} strokeWidth={2} aria-hidden />
                      Fiados
                    </Link>
                  </li>
                )}
                {canAccessBackOffice && (
                  <li role="none">
                    <Link
                      to="/app/cash"
                      role="menuitem"
                      onClick={() => setShowMobileMore(false)}
                    >
                      <Banknote size={16} strokeWidth={2} aria-hidden />
                      Caixa
                    </Link>
                  </li>
                )}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy || cart.length === 0}
                    onClick={() => {
                      setShowMobileMore(false)
                      setShowDiscount(true)
                    }}
                  >
                    Desconto
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy || cart.length === 0 || heldSales.length >= maxHeldSales}
                    onClick={() => {
                      setShowMobileMore(false)
                      void handleHoldSale()
                    }}
                  >
                    <Pause size={16} strokeWidth={2} aria-hidden />
                    Colocar em espera
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="pos-page__body">
      {toast && (
        <div className="pos-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {showRecentSales && (
        <PosRecentSalesPanel
          sales={recentSales}
          loading={loadingRecentSales}
          offerWhatsapp={Boolean(organization?.offerWhatsappReceiptOnSale)}
          onWhatsapp={(sale) => {
            setShowRecentSales(false)
            setWhatsappReceipt({
              sale,
              phone: sale.customerPhone,
              copy: 'segunda_via',
            })
          }}
          onClose={() => setShowRecentSales(false)}
        />
      )}

      {showBarcodeScanner && (
        <PosBarcodeScanner
          onDetect={handleBarcodeDetect}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {whatsappReceipt && organization && (
        <WhatsappReceiptSheet
          sale={whatsappReceipt.sale}
          organization={organization}
          initialPhone={whatsappReceipt.phone}
          copy={whatsappReceipt.copy}
          onClose={() => setWhatsappReceipt(null)}
        />
      )}

      {splitPayments && (
        <PosRemainingPaymentModal
          totalCents={totalCents}
          payments={splitPayments}
          methods={paymentMethods}
          busy={busy}
          onConfirm={(next) => void handleSplitConfirm(next)}
          onCancel={() => setSplitPayments(null)}
        />
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

      {quickOpen && (
        <PosQuickItemPanel
          mode={quickMode}
          initialName={quickName}
          initialBarcode={quickBarcode}
          busy={busy}
          error={error}
          onModeChange={setQuickMode}
          onRegister={quickCreateAndAdd}
          onLoose={addLooseItem}
          onClose={() => {
            setQuickOpen(false)
            searchRef.current?.focus()
          }}
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
              <div className="pos-page__cart-actions">
                <button
                  type="button"
                  className="pos-page__ghost pos-page__desk-only"
                  onClick={() => void handleHoldSale()}
                  disabled={busy || heldSales.length >= maxHeldSales}
                  title={
                    heldSales.length >= maxHeldSales
                      ? `Limite de ${maxHeldSales} esperas neste aparelho`
                      : 'Colocar venda em espera'
                  }
                >
                  <Pause size={15} strokeWidth={2} aria-hidden />
                  Espera
                </button>
                <button
                  type="button"
                  className="pos-page__ghost"
                  onClick={requestClear}
                  disabled={busy}
                >
                  Limpar
                </button>
              </div>
            )}
          </header>

          {heldSales.length > 0 && (
            <div className="pos-page__holds" aria-label="Vendas em espera">
              <p className="pos-page__holds-title">
                Em espera ({heldSales.length}/{maxHeldSales})
              </p>
              <ul className="pos-page__holds-list">
                {heldSales.map((held) => {
                  const qty = held.cart.reduce((sum, item) => sum + item.quantity, 0)
                  return (
                    <li key={held.id}>
                      <div>
                        <strong>{held.label}</strong>
                        <span>
                          {qty} item(ns) ·{' '}
                          {new Date(held.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="pos-page__holds-actions">
                        <button
                          type="button"
                          onClick={() => void handleResumeHeld(held.id)}
                          disabled={busy}
                          title="Retomar"
                        >
                          <Play size={14} strokeWidth={2} aria-hidden />
                          Retomar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscardHeld(held.id)}
                          disabled={busy}
                          title="Descartar"
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="pos-page__empty-cart">
              <strong className="pos-page__empty-mode">
                {customer ? customer.name : 'Caixa livre'}
              </strong>
              <p className="pos-page__empty-hint pos-page__desk-only">
                Passe o código, busque pelo nome ou use Avulsa / cadastro rápido.
              </p>
              <p className="pos-page__empty-hint pos-page__phone-only">
                Busque pelo código ou nome do produto.
              </p>
            </div>
          ) : (
            <ul className="pos-page__cart-list">
              {cart.map((item) => (
                <li key={item.productId}>
                  <div className="pos-page__item-info">
                    <strong>
                      {item.name}
                      {item.loose ? <em> · avulsa</em> : null}
                    </strong>
                    {editingPriceId === item.productId ? (
                      <input
                        className="pos-page__price-input"
                        value={priceDraft}
                        onChange={(event) => setPriceDraft(event.target.value)}
                        onBlur={() => commitPriceEdit(item.productId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitPriceEdit(item.productId)
                          }
                          if (event.key === 'Escape') setEditingPriceId(null)
                        }}
                        inputMode="decimal"
                        aria-label={`Preço de ${item.name}`}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="pos-page__price-btn"
                        onClick={() => startPriceEdit(item.productId, item.unitPriceCents)}
                        disabled={busy}
                      >
                        {formatMoney(item.unitPriceCents)} cada
                        {item.catalogPriceCents != null &&
                        item.catalogPriceCents !== item.unitPriceCents
                          ? ' · ajustado'
                          : ''}
                      </button>
                    )}
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
            className={
              showDiscount
                ? 'pos-page__ghost pos-page__discount-toggle'
                : 'pos-page__ghost pos-page__discount-toggle pos-page__desk-only'
            }
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

          {activeMethod && (
            <label className="pos-page__cash">
              Valor neste pagamento
              <input
                value={paymentAmountDraft}
                onChange={(e) => onPaymentAmountChange(e.target.value)}
                placeholder="0,00"
                disabled={busy}
                inputMode="decimal"
                aria-label={`Valor em ${PAYMENT_METHOD_LABELS[activeMethod]}`}
              />
            </label>
          )}

          {activeMethod === PAYMENT_METHODS.CASH && changeCents > 0 && (
            <div className="pos-page__change">
              <span>Troco</span>
              <strong>{formatMoney(changeCents)}</strong>
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
