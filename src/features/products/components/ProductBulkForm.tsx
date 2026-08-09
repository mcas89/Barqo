import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import { useAuth } from '../../../shared/hooks/useAuth'
import { listCategories } from '../services/category-service'
import type { ProductCategory } from '../types/category'
import {
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  formatProductTextInput,
  normalizeProductText,
  type Product,
  type ProductInput,
  type ProductUnit,
} from '../types'
import { buildBarcodeMeta } from '../services/barcode-service'
import './ProductBulkForm.css'

const MARKUP_STORAGE_KEY = 'balqo.productBulk.markupPercent'

interface ProductBulkFormProps {
  saving: boolean
  findByBarcode: (barcode: string) => Product | null
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
  canAddProduct: boolean
  planLimitMessage?: string
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function readStoredMarkup(): string {
  try {
    const raw = localStorage.getItem(MARKUP_STORAGE_KEY)
    if (!raw) return '40'
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return '40'
    return String(n).replace('.', ',')
  } catch {
    return '40'
  }
}

function suggestedPriceFromCost(costCents: number, markupPercent: number): number {
  if (costCents <= 0) return 0
  return Math.round(costCents * (1 + markupPercent / 100))
}

export function ProductBulkForm({
  saving,
  findByBarcode,
  onSubmit,
  onCancel,
  canAddProduct,
  planLimitMessage,
}: ProductBulkFormProps) {
  const { organization } = useAuth()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)

  const [markupPercent, setMarkupPercent] = useState(readStoredMarkup)
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState<ProductUnit>('UN')
  const [categories, setCategories] = useState<ProductCategory[]>([])

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [stock, setStock] = useState('0')

  const [localError, setLocalError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    void listCategories(organization.id)
      .then((items) => {
        if (!cancelled) setCategories(items)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [organization?.id])

  useEffect(() => {
    try {
      const n = Number(markupPercent.replace(',', '.'))
      if (Number.isFinite(n) && n >= 0) {
        localStorage.setItem(MARKUP_STORAGE_KEY, String(n))
      }
    } catch {
      /* ignore */
    }
  }, [markupPercent])

  function applySuggestedPrice(nextCost: string, nextMarkup: string) {
    if (priceTouched) return
    const costCents = parseMoneyToCents(nextCost)
    const markup = Number(nextMarkup.replace(',', '.'))
    if (!Number.isFinite(markup) || costCents <= 0) return
    const suggested = suggestedPriceFromCost(costCents, markup)
    if (suggested > 0) setPrice(centsToInput(suggested))
  }

  function onCostChange(value: string) {
    setCost(value)
    applySuggestedPrice(value, markupPercent)
  }

  function onMarkupChange(value: string) {
    setMarkupPercent(value)
    applySuggestedPrice(cost, value)
  }

  function onPriceChange(value: string) {
    setPriceTouched(true)
    setPrice(value)
  }

  function resetLine() {
    setBarcode('')
    setName('')
    setStock('0')
    setLocalError(null)
    requestAnimationFrame(() => barcodeRef.current?.focus())
  }

  async function handleSave() {
    setLocalError(null)
    setLastSaved(null)

    if (!canAddProduct) {
      setLocalError(planLimitMessage ?? 'Limite de produtos do plano atingido.')
      return
    }

    const trimmedName = normalizeProductText(name)
    if (!trimmedName) {
      setLocalError('Informe o nome do produto.')
      nameRef.current?.focus()
      return
    }

    const priceCents = parseMoneyToCents(price)
    if (priceCents <= 0) {
      setLocalError('Defina o preço de venda nos dados pré-definidos.')
      return
    }

    const stockQty = Number(stock.replace(',', '.'))
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      setLocalError('Estoque inválido.')
      stockRef.current?.focus()
      return
    }

    const code = barcode.trim()
    if (code) {
      const existing = findByBarcode(code)
      if (existing) {
        setLocalError(`Código já cadastrado: ${existing.name}`)
        barcodeRef.current?.focus()
        barcodeRef.current?.select()
        return
      }
    }

    const input: ProductInput = {
      name: trimmedName,
      barcode: code || undefined,
      barcodeMeta: code ? buildBarcodeMeta({ value: code }) : undefined,
      category: category ? normalizeProductText(category) : undefined,
      unit,
      type: PRODUCT_TYPES.PRODUCT,
      priceCents,
      costCents: parseMoneyToCents(cost),
      stock: stockQty,
      minStock: 0,
      active: true,
    }

    try {
      await onSubmit(input)
      setSavedCount((n) => n + 1)
      setLastSaved(trimmedName)
      resetLine()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar produto.')
    }
  }

  function onBarcodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const code = barcode.trim()
    if (code) {
      const existing = findByBarcode(code)
      if (existing) {
        setLocalError(`Código já cadastrado: ${existing.name}`)
        barcodeRef.current?.select()
        return
      }
    }
    setLocalError(null)
    nameRef.current?.focus()
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (!normalizeProductText(name)) {
      setLocalError('Informe o nome do produto.')
      return
    }
    setLocalError(null)
    stockRef.current?.focus()
    stockRef.current?.select()
  }

  function onStockKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (saving) return
    void handleSave()
  }

  function onFormSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    void handleSave()
  }

  const costCents = parseMoneyToCents(cost)
  const priceCents = parseMoneyToCents(price)
  const markup = Number(markupPercent.replace(',', '.'))
  const previewSuggested =
    Number.isFinite(markup) && costCents > 0
      ? suggestedPriceFromCost(costCents, markup)
      : 0

  return (
    <form className="product-bulk" onSubmit={onFormSubmit}>
      <header className="product-bulk__header">
        <div>
          <h2>Cadastro em massa</h2>
          <p>
            Defina custo, margem e preço uma vez. Depois só digite código, nome e estoque —
            Enter salva e volta ao início.
          </p>
        </div>
        <button type="button" className="product-bulk__ghost" onClick={onCancel} disabled={saving}>
          Voltar à lista
        </button>
      </header>

      <section className="product-bulk__defaults" aria-label="Dados pré-definidos">
        <h3>Dados pré-definidos</h3>
        <div className="product-bulk__defaults-grid">
          <label>
            Margem %
            <input
              inputMode="decimal"
              value={markupPercent}
              onChange={(e) => onMarkupChange(e.target.value)}
              disabled={saving}
              aria-label="Margem percentual sobre o custo"
            />
          </label>
          <label>
            Custo (R$)
            <input
              inputMode="decimal"
              value={cost}
              onChange={(e) => onCostChange(e.target.value)}
              disabled={saving}
              placeholder="0,00"
            />
          </label>
          <label>
            Preço de venda (R$)
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
              disabled={saving}
              placeholder="0,00"
            />
            {previewSuggested > 0 && (
              <span className="product-bulk__hint">
                Sugerido: {formatMoney(previewSuggested)}
                {priceTouched ? ' · editado' : ''}
              </span>
            )}
          </label>
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            >
              <option value="">Sem categoria</option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unidade
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductUnit)}
              disabled={saving}
            >
              {PRODUCT_UNITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        {priceCents > 0 && (
          <p className="product-bulk__price-banner">
            Cada item será salvo a <strong>{formatMoney(priceCents)}</strong>
            {costCents > 0 ? ` · custo ${formatMoney(costCents)}` : ''}
            {category ? ` · ${category}` : ''}
          </p>
        )}
      </section>

      <section className="product-bulk__line" aria-label="Próximo produto">
        <h3>
          Próximo produto
          {savedCount > 0 ? (
            <span className="product-bulk__count">{savedCount} salvo(s) nesta sessão</span>
          ) : null}
        </h3>

        <div className="product-bulk__line-grid">
          <label>
            Código
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={onBarcodeKeyDown}
              disabled={saving}
              autoComplete="off"
              placeholder="Leia ou digite e Enter"
            />
          </label>
          <label>
            Nome
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(formatProductTextInput(e.target.value))}
              onKeyDown={onNameKeyDown}
              disabled={saving}
              autoComplete="off"
              placeholder="Nome do produto"
            />
          </label>
          <label>
            Qtd. estoque
            <input
              ref={stockRef}
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              onKeyDown={onStockKeyDown}
              disabled={saving}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="product-bulk__actions">
          <button type="submit" disabled={saving || !canAddProduct}>
            {saving ? 'Salvando…' : 'Salvar e próximo (Enter)'}
          </button>
          <button
            type="button"
            className="product-bulk__ghost"
            onClick={resetLine}
            disabled={saving}
          >
            Limpar linha
          </button>
        </div>
      </section>

      {localError && (
        <p className="product-bulk__error" role="alert">
          {localError}
        </p>
      )}
      {lastSaved && !localError && (
        <p className="product-bulk__ok" role="status">
          Salvo: {lastSaved}. Pronto para o próximo.
        </p>
      )}
    </form>
  )
}
