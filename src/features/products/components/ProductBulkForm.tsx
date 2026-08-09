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
  type ProductBarcodeMeta,
  type ProductInput,
  type ProductUnit,
} from '../types'
import {
  buildBarcodeMeta,
  generateBalqoInternalBarcode,
} from '../services/barcode-service'
import './ProductBulkForm.css'

const MARKUP_STORAGE_KEY = 'balqo.product.markupPercent'

interface ProductBulkFormProps {
  saving: boolean
  findByBarcode: (barcode: string) => Product | null
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
  canAddProduct: boolean
  planLimitMessage?: string
  canGenerate?: boolean
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

/** Preço de venda = custo × (1 + margem%). */
function salePriceFromCost(costCents: number, markupPercent: number): number {
  if (costCents <= 0) return 0
  if (!Number.isFinite(markupPercent) || markupPercent < 0) return 0
  return Math.round(costCents * (1 + markupPercent / 100))
}

export function ProductBulkForm({
  saving,
  findByBarcode,
  onSubmit,
  onCancel,
  canAddProduct,
  planLimitMessage,
  canGenerate = true,
}: ProductBulkFormProps) {
  const { organization } = useAuth()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const costRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)

  const [markupPercent, setMarkupPercent] = useState(readStoredMarkup)
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState<ProductUnit>('UN')
  const [categories, setCategories] = useState<ProductCategory[]>([])

  const [barcode, setBarcode] = useState('')
  const [barcodeMeta, setBarcodeMeta] = useState<ProductBarcodeMeta | undefined>()
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('0')

  const [localError, setLocalError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  const markup = Number(markupPercent.replace(',', '.'))
  const costCents = parseMoneyToCents(cost)
  const salePriceCents =
    costCents > 0 && Number.isFinite(markup) && markup >= 0
      ? salePriceFromCost(costCents, markup)
      : 0

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

  function resetLine() {
    setBarcode('')
    setBarcodeMeta(undefined)
    setName('')
    setCost('')
    setStock('0')
    setLocalError(null)
    requestAnimationFrame(() => barcodeRef.current?.focus())
  }

  function handleGenerateCode() {
    if (!canGenerate) {
      setLocalError('Sem permissão para gerar código de barras.')
      return
    }
    const value = generateBalqoInternalBarcode()
    setBarcode(value)
    setBarcodeMeta(
      buildBarcodeMeta({
        value,
        type: 'code128_internal',
        source: 'balqo_generated',
      }),
    )
    setLocalError(null)
    requestAnimationFrame(() => nameRef.current?.focus())
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

    if (costCents <= 0) {
      setLocalError('Informe o preço de custo.')
      costRef.current?.focus()
      return
    }

    if (salePriceCents <= 0) {
      setLocalError('Defina a margem % para calcular o preço de venda.')
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
      barcodeMeta: code
        ? barcodeMeta && barcodeMeta.value === code
          ? barcodeMeta
          : buildBarcodeMeta({ value: code })
        : undefined,
      category: category ? normalizeProductText(category) : undefined,
      unit,
      type: PRODUCT_TYPES.PRODUCT,
      priceCents: salePriceCents,
      costCents,
      stock: stockQty,
      minStock: 0,
      active: true,
    }

    try {
      await onSubmit(input)
      setSavedCount((n) => n + 1)
      setLastSaved(`${trimmedName} · venda ${formatMoney(salePriceCents)}`)
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
    costRef.current?.focus()
    costRef.current?.select()
  }

  function onCostKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (parseMoneyToCents(cost) <= 0) {
      setLocalError('Informe o preço de custo.')
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

  return (
    <form className="product-bulk" onSubmit={onFormSubmit}>
      <header className="product-bulk__header">
        <div>
          <h2>Cadastro em massa</h2>
          <p>
            Margem, categoria e unidade ficam fixos. Digite o custo — o preço de venda
            calcula sozinho. Ordem: código, nome, custo, estoque.
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
              onChange={(e) => setMarkupPercent(e.target.value)}
              disabled={saving}
              aria-label="Margem percentual sobre o custo"
            />
            <span className="product-bulk__hint">Preço de venda = custo + esta margem</span>
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
      </section>

      <section className="product-bulk__line" aria-label="Próximo produto">
        <h3>
          Próximo produto
          {savedCount > 0 ? (
            <span className="product-bulk__count">{savedCount} salvo(s) nesta sessão</span>
          ) : null}
        </h3>

        <div className="product-bulk__line-grid product-bulk__line-grid--four">
          <label className="product-bulk__code-field">
            Código
            <div className="product-bulk__code-row">
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value)
                  setBarcodeMeta(undefined)
                }}
                onKeyDown={onBarcodeKeyDown}
                disabled={saving}
                autoComplete="off"
                placeholder="Leia, digite ou gere"
              />
              {canGenerate && (
                <button
                  type="button"
                  className="product-bulk__gen-btn"
                  onClick={handleGenerateCode}
                  disabled={saving}
                  title="Gerar código BALQO"
                >
                  Gerar
                </button>
              )}
            </div>
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
            Custo (R$)
            <input
              ref={costRef}
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              onKeyDown={onCostKeyDown}
              disabled={saving}
              autoComplete="off"
              placeholder="0,00"
            />
            {salePriceCents > 0 ? (
              <span className="product-bulk__hint product-bulk__hint--sale">
                Venda: {formatMoney(salePriceCents)}
                {costCents > 0 ? ` (${centsToInput(costCents)} + ${markupPercent}%)` : ''}
              </span>
            ) : (
              <span className="product-bulk__hint">Preço de venda aparece aqui</span>
            )}
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
          {canGenerate && (
            <button
              type="button"
              className="product-bulk__ghost"
              onClick={handleGenerateCode}
              disabled={saving}
            >
              Gerar código BALQO
            </button>
          )}
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
