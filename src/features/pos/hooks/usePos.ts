import { useCallback, useEffect, useMemo, useState } from 'react'
import { resolvePersonName } from '../../../shared/lib/person-name'
import { useAuth } from '../../../shared/hooks/useAuth'

import {
  getOpenCashSession,
  openCashSession,
} from '../../cash-register/services/cash-service'
import type { CashSession } from '../../cash-register/types'
import { listProducts, type Product } from '../../products'
import {
  cartSubtotalCents,
  cartTotalCents,
  completeSale,
  paymentsTotalCents,
} from '../services/sale-service'
import type { CartItem, PaymentMethod, Sale, SalePayment } from '../types'
import { PAYMENT_METHODS } from '../types'
import { usePosOperator } from './usePosOperator'

export function usePos() {
  const { organization, user } = useAuth()
  const { operator } = usePosOperator()
  const [catalog, setCatalog] = useState<Product[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [loadingCash, setLoadingCash] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [payments, setPayments] = useState<SalePayment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  /** Cliente da venda — null = Caixa livre */
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null)

  const organizationId = organization?.id
  const cashOpen = Boolean(cashSession)

  const refreshCashSession = useCallback(async () => {
    if (!organizationId) {
      setCashSession(null)
      setLoadingCash(false)
      return
    }

    setLoadingCash(true)
    try {
      const open = await getOpenCashSession(organizationId)
      setCashSession(open)
    } catch (err) {
      console.error(err)
      setError('Não foi possível verificar o caixa.')
    } finally {
      setLoadingCash(false)
    }
  }, [organizationId])

  const refreshCatalog = useCallback(async () => {
    if (!organizationId) {
      setCatalog([])
      setLoadingCatalog(false)
      return
    }

    setLoadingCatalog(true)
    try {
      const products = await listProducts(organizationId)
      setCatalog(products)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o catálogo.')
    } finally {
      setLoadingCatalog(false)
    }
  }, [organizationId])

  useEffect(() => {
    void refreshCatalog()
    void refreshCashSession()
  }, [refreshCatalog, refreshCashSession])

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return catalog
      .filter((product) => {
        const haystack = [product.name, product.barcode, product.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [catalog, search])

  const subtotalCents = cartSubtotalCents(cart)
  const totalCents = cartTotalCents(cart, discountCents)
  const paidCents = paymentsTotalCents(payments)
  const changeCents = Math.max(0, paidCents - totalCents)
  const remainingCents = Math.max(0, totalCents - paidCents)

  function ensureCashOpen(): boolean {
    if (cashSession) return true
    setError('Abra o caixa para começar a vender.')
    return false
  }

  function addProduct(product: Product, quantity = 1) {
    setLastSale(null)
    if (!ensureCashOpen()) return

    if (product.type === 'product' && product.stock <= 0) {
      setError(`${product.name} sem estoque.`)
      return
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      const nextQty = (existing?.quantity ?? 0) + quantity

      if (product.type === 'product' && nextQty > product.stock) {
        setError(`Estoque insuficiente para ${product.name}.`)
        return current
      }

      setError(null)

      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQty } : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          costCents: product.costCents,
          quantity,
          type: product.type,
          availableStock: product.type === 'product' ? product.stock : undefined,
        },
      ]
    })
  }

  function addBySearchEnter() {
    if (!ensureCashOpen()) return
    const term = search.trim().toLowerCase()
    if (!term) return

    const exactBarcode = catalog.find(
      (product) => product.barcode?.toLowerCase() === term,
    )
    if (exactBarcode) {
      addProduct(exactBarcode)
      setSearch('')
      return
    }

    if (filteredCatalog[0]) {
      addProduct(filteredCatalog[0])
      setSearch('')
    }
  }

  function setItemQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item
          const next = Math.max(0, quantity)
          if (
            item.type === 'product' &&
            item.availableStock != null &&
            next > item.availableStock
          ) {
            setError(`Estoque insuficiente para ${item.name}.`)
            return item
          }
          return { ...item, quantity: next }
        })
        .filter((item) => item.quantity > 0),
    )
  }

  function removeItem(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId))
  }

  function clearCart() {
    setCart([])
    setDiscountCents(0)
    setPayments([])
    setError(null)
  }

  function setPaymentAmount(method: PaymentMethod, amountCents: number) {
    const value = Math.max(0, Math.round(amountCents))
    setPayments((current) => {
      const others = current.filter((payment) => payment.method !== method)
      if (value <= 0) return others
      return [...others, { method, amountCents: value }]
    })
  }

  function payFullWith(method: PaymentMethod) {
    setPayments([{ method, amountCents: totalCents }])
  }

  async function openCash(openingAmountCents: number) {
    if (!organizationId || !user) {
      setError('Sessão inválida.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const session = await openCashSession({
        organizationId,
        openingAmountCents,
        userId: user.id,
        userName: operator?.displayName || resolvePersonName(user.displayName, 'Proprietário'),
      })
      setCashSession(session)
      return session
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao abrir o caixa.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function finishSale(paymentOverride?: SalePayment[]) {
    if (!organizationId || !user) {
      setError('Sessão inválida.')
      return
    }
    if (!operator) {
      setError('Desbloqueie o PDV com o PIN do operador.')
      return
    }
    if (!cashSession) {
      setError('Abra o caixa antes de vender.')
      return
    }
    if (cart.length === 0) {
      setError('Adicione itens ao carrinho.')
      return
    }

    const finalPayments = paymentOverride ?? payments
    const paid = paymentsTotalCents(finalPayments)
    if (paid < totalCents) {
      setError('Complete o pagamento antes de finalizar.')
      return
    }

    const hasFiado = finalPayments.some(
      (payment) => payment.method === 'on_account',
    )
    if (hasFiado && !customer) {
      setError('Selecione o cliente para vender no fiado.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const sale = await completeSale({
        organizationId,
        items: cart,
        discountCents,
        payments: finalPayments,
        soldByUserId: user.id,
        soldByName: operator.displayName,
        cashSessionId: cashSession.id,
        operatorId: operator.id,
        operatorRole: operator.role,
        customerId: customer?.id,
        customerName: customer?.name,
        note: customer ? `Cliente: ${customer.name}` : 'Caixa livre',
      })
      setLastSale(sale)
      clearCart()
      setCustomer(null)
      await refreshCatalog()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao finalizar a venda.')
    } finally {
      setBusy(false)
    }
  }

  const clearLastSale = useCallback(() => setLastSale(null), [])

  return {
    organization,
    user,
    catalog,
    loadingCatalog,
    cashSession,
    cashOpen,
    loadingCash,
    search,
    setSearch,
    filteredCatalog,
    cart,
    discountCents,
    setDiscountCents,
    payments,
    subtotalCents,
    totalCents,
    paidCents,
    changeCents,
    remainingCents,
    busy,
    error,
    setError,
    lastSale,
    clearLastSale,
    customer,
    setCustomer,
    customerLabel: customer?.name.trim() || 'Caixa livre',
    addProduct,
    addBySearchEnter,
    setItemQuantity,
    removeItem,
    clearCart,
    setPaymentAmount,
    payFullWith,
    finishSale,
    openCash,
    refreshCashSession,
    paymentMethods: PAYMENT_METHODS,
  }
}
