import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Plus, ScanLine } from 'lucide-react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import { useAuth } from '../../../shared/hooks/useAuth'
import { PosBarcodeScanner } from '../../pos/components/PosBarcodeScanner'
import {
  createCategory,
  listCategories,
} from '../services/category-service'
import { listProducts } from '../services/product-service'
import { DEFAULT_YIELD_PERCENT, doseCostCentsFromBase, formatProductStockLabel, usesBottleStockModel } from '../services/dose-service'
import type { ProductCategory } from '../types/category'
import {
  BARCODE_SOURCE_LABELS,
  BARCODE_TYPE_LABELS,
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  PREP_STATION_LABELS,
  defaultPrepStationForType,
  formatProductTextInput,
  normalizeProductText,
  productTracksOwnStock,
  type Product,
  type ProductBarcodeMeta,
  type ProductInput,
  type ProductType,
  type ProductUnit,
  type PrepStation,
} from '../types'
import {
  buildBarcodeMeta,
  generateBalqoInternalBarcode,
  productHasBarcode,
} from '../services/barcode-service'
import './ProductForm.css'

const MARKUP_STORAGE_KEY = 'balqo.product.markupPercent'

interface ProductFormProps {
  initial?: Product | null
  saving: boolean
  findByBarcode: (barcode: string) => Product | null
  onResolvedProduct: (product: Product | null) => void
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
  onGenerateSaved?: () => Promise<void>
  onPrintLabel?: () => void
  canGenerate?: boolean
  canChange?: boolean
  canPrint?: boolean
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

function persistMarkup(value: string) {
  try {
    const n = Number(value.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) {
      localStorage.setItem(MARKUP_STORAGE_KEY, String(n))
    }
  } catch {
    /* ignore */
  }
}

function suggestedPriceFromCost(costCents: number, markupPercent: number): number {
  if (costCents <= 0) return 0
  if (!Number.isFinite(markupPercent) || markupPercent < 0) return 0
  return Math.round(costCents * (1 + markupPercent / 100))
}

function markupFromCostAndPrice(costCents: number, priceCents: number): string {
  if (costCents <= 0 || priceCents <= 0) return readStoredMarkup()
  const pct = (priceCents / costCents - 1) * 100
  if (!Number.isFinite(pct) || pct < 0) return readStoredMarkup()
  const rounded = Math.round(pct * 100) / 100
  return String(rounded).replace('.', ',')
}

function fillFromProduct(
  product: Product | null,
  setters: {
    setName: (v: string) => void
    setBarcode: (v: string) => void
    setBarcodeMeta?: (v: ProductBarcodeMeta | undefined) => void
    setCategory: (v: string) => void
    setUnit: (v: ProductUnit) => void
    setType: (v: Product['type']) => void
    setPrepStation?: (v: PrepStation) => void
    setPrice: (v: string) => void
    setCost: (v: string) => void
    setMarkupPercent: (v: string) => void
    setStock: (v: string) => void
    setMinStock: (v: string) => void
    setActive: (v: boolean) => void
  },
  keepBarcode?: string,
) {
  if (!product) {
    setters.setName('')
    setters.setBarcode(keepBarcode ?? '')
    setters.setBarcodeMeta?.(
      keepBarcode ? buildBarcodeMeta({ value: keepBarcode }) : undefined,
    )
    setters.setCategory('')
    setters.setUnit('UN')
    setters.setType(PRODUCT_TYPES.PRODUCT)
    setters.setPrepStation?.(defaultPrepStationForType(PRODUCT_TYPES.PRODUCT))
    setters.setPrice('')
    setters.setCost('')
    setters.setMarkupPercent(readStoredMarkup())
    setters.setStock('0')
    setters.setMinStock('0')
    setters.setActive(true)
    return
  }

  setters.setName(product.name)
  setters.setBarcode(product.barcode ?? keepBarcode ?? '')
  setters.setBarcodeMeta?.(product.barcodeMeta)
  setters.setCategory(product.category ?? '')
  setters.setUnit(product.unit)
  setters.setType(product.type)
  setters.setPrepStation?.(
    product.prepStation ?? defaultPrepStationForType(product.type),
  )
  setters.setPrice(centsToInput(product.priceCents))
  setters.setCost(centsToInput(product.costCents))
  setters.setMarkupPercent(
    markupFromCostAndPrice(product.costCents, product.priceCents),
  )
  setters.setStock(
    String(
      usesBottleStockModel(product)
        ? Math.max(0, Math.floor(Number(product.stock) || 0))
        : (product.stock ?? 0),
    ),
  )
  setters.setMinStock(String(product.minStock ?? 0))
  setters.setActive(product.active)
}

export function ProductForm({
  initial,
  saving,
  findByBarcode,
  onResolvedProduct,
  onSubmit,
  onCancel,
  onGenerateSaved,
  onPrintLabel,
  canGenerate = true,
  canChange = true,
  canPrint = true,
}: ProductFormProps) {
  const barcodeRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [barcodeMeta, setBarcodeMeta] = useState<ProductBarcodeMeta | undefined>(
    initial?.barcodeMeta,
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [unit, setUnit] = useState<ProductUnit>(initial?.unit ?? 'UN')
  const [type, setType] = useState(initial?.type ?? PRODUCT_TYPES.PRODUCT)
  const [prepStation, setPrepStation] = useState<PrepStation>(
    initial?.prepStation ?? defaultPrepStationForType(initial?.type ?? PRODUCT_TYPES.PRODUCT),
  )
  const [price, setPrice] = useState(initial ? centsToInput(initial.priceCents) : '')
  const [cost, setCost] = useState(initial ? centsToInput(initial.costCents) : '')
  const [markupPercent, setMarkupPercent] = useState(() =>
    initial
      ? markupFromCostAndPrice(initial.costCents, initial.priceCents)
      : readStoredMarkup(),
  )
  const [stock, setStock] = useState(String(initial?.stock ?? 0))
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0))
  const [contentMl, setContentMl] = useState(
    initial?.contentMl != null ? String(initial.contentMl) : '',
  )
  const [doseBaseProductId, setDoseBaseProductId] = useState(
    initial?.doseBaseProductId ?? '',
  )
  const [doseMl, setDoseMl] = useState(
    initial?.doseMl != null ? String(initial.doseMl) : '',
  )
  const [doseYieldPercent, setDoseYieldPercent] = useState(
    String(initial?.doseYieldPercent ?? DEFAULT_YIELD_PERCENT),
  )
  const [baseCatalog, setBaseCatalog] = useState<Product[]>([])
  const [stockCatalog, setStockCatalog] = useState<Product[]>([])
  const [showDoseAdvanced, setShowDoseAdvanced] = useState(false)
  const [active, setActive] = useState(initial?.active ?? true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'found' | 'new'>('idle')
  const [editingCode, setEditingCode] = useState(!Boolean(initial?.barcode?.trim()))
  const [generateNotice, setGenerateNotice] = useState<string | null>(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [showQuickCategory, setShowQuickCategory] = useState(false)
  const [quickCategoryName, setQuickCategoryName] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const { organization } = useAuth()
  const quickCategoryRef = useRef<HTMLInputElement>(null)

  const setters = {
    setName,
    setBarcode,
    setBarcodeMeta,
    setCategory,
    setUnit,
    setType,
    setPrepStation,
    setPrice,
    setCost,
    setMarkupPercent,
    setStock,
    setMinStock,
    setActive,
  }

  function applySuggestedPrice(nextCost: string, nextMarkup: string) {
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
    persistMarkup(value)
    applySuggestedPrice(cost, value)
  }

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setBarcode(initial.barcode ?? '')
      setBarcodeMeta(initial.barcodeMeta)
      setCategory(initial.category ?? '')
      setUnit(initial.unit)
      setType(initial.type)
      setPrepStation(initial.prepStation ?? defaultPrepStationForType(initial.type))
      setPrice(centsToInput(initial.priceCents))
      setCost(centsToInput(initial.costCents))
      setMarkupPercent(markupFromCostAndPrice(initial.costCents, initial.priceCents))
      setStock(
        String(
          usesBottleStockModel(initial)
            ? Math.max(0, Math.floor(Number(initial.stock) || 0))
            : (initial.stock ?? 0),
        ),
      )
      setMinStock(String(initial.minStock ?? 0))
      setContentMl(initial.contentMl != null ? String(initial.contentMl) : '')
      setDoseBaseProductId(initial.doseBaseProductId ?? '')
      setDoseMl(initial.doseMl != null ? String(initial.doseMl) : '')
      setDoseYieldPercent(String(initial.doseYieldPercent ?? DEFAULT_YIELD_PERCENT))
      setActive(initial.active)
      setLookupStatus('found')
      setEditingCode(!Boolean(initial.barcode?.trim()))
    } else {
      setName('')
      setBarcode('')
      setBarcodeMeta(undefined)
      setCategory('')
      setUnit('UN')
      setType(PRODUCT_TYPES.PRODUCT)
      setPrepStation(defaultPrepStationForType(PRODUCT_TYPES.PRODUCT))
      setPrice('')
      setCost('')
      setMarkupPercent(readStoredMarkup())
      setStock('0')
      setMinStock('0')
      setContentMl('')
      setDoseBaseProductId('')
      setDoseMl('')
      setDoseYieldPercent(String(DEFAULT_YIELD_PERCENT))
      setActive(true)
      setLookupStatus('idle')
      setEditingCode(true)
      barcodeRef.current?.focus()
    }
    setLocalError(null)
    setGenerateNotice(null)
    setShowQuickCategory(false)
    setQuickCategoryName('')
  }, [initial])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    void listProducts(organization.id, { includeInactive: false })
      .then((items) => {
        if (cancelled) return
        setStockCatalog(items)
        setBaseCatalog(
          items.filter(
            (item) =>
              item.type === PRODUCT_TYPES.PRODUCT &&
              item.id !== initial?.id,
          ),
        )
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [organization?.id, initial?.id])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    void listCategories(organization.id)
      .then((items) => {
        if (!cancelled) setCategories(items)
      })
      .catch((err) => {
        console.error(err)
      })
    return () => {
      cancelled = true
    }
  }, [organization?.id])

  useEffect(() => {
    if (showQuickCategory) {
      requestAnimationFrame(() => quickCategoryRef.current?.focus())
    }
  }, [showQuickCategory])

  async function refreshCategories() {
    if (!organization?.id) return
    setCategories(await listCategories(organization.id))
  }

  async function handleQuickCreateCategory() {
    if (!organization?.id) return
    const name = normalizeProductText(quickCategoryName)
    if (!name) {
      setLocalError('Informe o nome da categoria.')
      return
    }
    setCategoryBusy(true)
    setLocalError(null)
    try {
      const created = await createCategory(organization.id, { name })
      await refreshCategories()
      setCategory(created.name)
      setShowQuickCategory(false)
      setQuickCategoryName('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao criar categoria.')
    } finally {
      setCategoryBusy(false)
    }
  }

  function resolveBarcode(code: string) {
    const trimmed = code.trim()
    setLocalError(null)
    setGenerateNotice(null)

    if (!trimmed) {
      setLookupStatus('idle')
      setBarcodeMeta(undefined)
      onResolvedProduct(null)
      return
    }

    const found = findByBarcode(trimmed)
    if (found) {
      fillFromProduct(found, setters)
      setLookupStatus('found')
      setEditingCode(false)
      onResolvedProduct(found)
      requestAnimationFrame(() => {
        if (productTracksOwnStock(found.type)) {
          stockRef.current?.focus()
          stockRef.current?.select()
        } else {
          nameRef.current?.focus()
        }
      })
      return
    }

    fillFromProduct(null, setters, trimmed)
    setBarcodeMeta(buildBarcodeMeta({ value: trimmed }))
    setLookupStatus('new')
    onResolvedProduct(null)
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  function onBarcodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      resolveBarcode(barcode)
    }
  }

  function openBarcodeScanner() {
    setEditingCode(true)
    setShowBarcodeScanner(true)
  }

  function handleBarcodeScanned(code: string) {
    setShowBarcodeScanner(false)
    setBarcode(code)
    setBarcodeMeta(undefined)
    resolveBarcode(code)
  }

  async function handleGenerateCode() {
    setLocalError(null)
    setGenerateNotice(null)

    if (initial?.id && onGenerateSaved && productHasBarcode(initial)) {
      setLocalError('Este produto já possui código. Use Alterar código se precisar trocar.')
      return
    }

    if (initial?.id && onGenerateSaved && !productHasBarcode(initial)) {
      try {
        await onGenerateSaved()
        setGenerateNotice('Código interno criado com sucesso.')
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Falha ao gerar código.')
      }
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
    setEditingCode(false)
    setGenerateNotice(`Código interno criado com sucesso.\n${value}`)
    setLookupStatus((status) => (status === 'idle' ? 'new' : status))
  }

  function requestChangeCode() {
    if (!canChange) {
      setLocalError('Sem permissão para alterar código de barras.')
      return
    }
    if (initial?.barcode) {
      const ok = window.confirm(
        'Este produto já possui código de barras.\n\nAlterar o código pode inutilizar etiquetas antigas.\nDeseja continuar?',
      )
      if (!ok) return
    }
    setEditingCode(true)
    setGenerateNotice(null)
    requestAnimationFrame(() => barcodeRef.current?.focus())
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    if (!name.trim()) {
      setLocalError('Informe o nome do produto.')
      return
    }

    const priceCents = parseMoneyToCents(price)
    if (priceCents <= 0) {
      setLocalError('Informe um preço de venda válido.')
      return
    }

    const selectedDoseBase = baseCatalog.find((item) => item.id === doseBaseProductId) ?? null
    const doseDerivedCostCents =
      type === PRODUCT_TYPES.DOSE && selectedDoseBase && Number(doseMl) > 0
        ? doseCostCentsFromBase({
            doseMl: Number(doseMl),
            yieldPercent: Number(doseYieldPercent) || DEFAULT_YIELD_PERCENT,
            base: selectedDoseBase,
          })
        : 0

    const trimmedBarcode = barcode.trim()
    const input: ProductInput = {
      name,
      barcode: trimmedBarcode || undefined,
      barcodeMeta: trimmedBarcode
        ? barcodeMeta && barcodeMeta.value === trimmedBarcode
          ? barcodeMeta
          : buildBarcodeMeta({ value: trimmedBarcode })
        : undefined,
      category,
      unit,
      type,
      prepStation,
      priceCents,
      costCents:
        type === PRODUCT_TYPES.DOSE ? doseDerivedCostCents : parseMoneyToCents(cost),
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      active,
      contentMl:
        type === PRODUCT_TYPES.PRODUCT && Number(contentMl) > 0
          ? Number(contentMl)
          : undefined,
      doseBaseProductId:
        type === PRODUCT_TYPES.DOSE ? doseBaseProductId || undefined : undefined,
      doseMl: type === PRODUCT_TYPES.DOSE && Number(doseMl) > 0 ? Number(doseMl) : undefined,
      doseYieldPercent:
        type === PRODUCT_TYPES.DOSE
          ? Number(doseYieldPercent) || DEFAULT_YIELD_PERCENT
          : undefined,
    }

    try {
      await onSubmit(input)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar. Tente novamente.')
    }
  }

  const tracksStock = productTracksOwnStock(type)
  const hasCode = Boolean(barcode.trim())
  const doseBasePreview = baseCatalog.find((item) => item.id === doseBaseProductId) ?? null
  const doseCostPreview =
    type === PRODUCT_TYPES.DOSE && doseBasePreview && Number(doseMl) > 0
      ? doseCostCentsFromBase({
          doseMl: Number(doseMl),
          yieldPercent: Number(doseYieldPercent) || DEFAULT_YIELD_PERCENT,
          base: doseBasePreview,
        })
      : 0
  const title =
    lookupStatus === 'found' || initial
      ? 'Atualizar item'
      : lookupStatus === 'new'
        ? 'Novo item'
        : 'Cadastrar / atualizar'

  const leadByType =
    type === PRODUCT_TYPES.DOSE
      ? 'Dose = o que você vende no caixa (ex.: taça). A garrafa é outro cadastro.'
      : type === PRODUCT_TYPES.MEAL
        ? 'Refeição = prato ou lanche. Sem estoque obrigatório.'
        : type === PRODUCT_TYPES.SERVICE
          ? 'Serviço = sem estoque (taxa, entrega, etc.).'
          : 'Produto = item com estoque (garrafa, refrigerante, utensílio…).'

  function onTypeChange(next: ProductType) {
    setType(next)
    setPrepStation(defaultPrepStationForType(next))
    if (!productTracksOwnStock(next)) {
      setStock('0')
      setMinStock('0')
      setUnit('UN')
    }
    if (next !== PRODUCT_TYPES.DOSE) {
      setDoseBaseProductId('')
      setDoseMl('')
      setDoseYieldPercent(String(DEFAULT_YIELD_PERCENT))
      setShowDoseAdvanced(false)
    }
    if (next !== PRODUCT_TYPES.PRODUCT) {
      setContentMl('')
    }
  }

  return (
    <form className="product-form" onSubmit={(e) => void handleSubmit(e)}>
      <header className="product-form__header">
        <div>
          <h2>{title}</h2>
          <p className="product-form__lead">{leadByType}</p>
        </div>
        {initial && (
          <span className="product-form__price-hint">{formatMoney(initial.priceCents)}</span>
        )}
      </header>

      <label className="product-form__type">
        O que você está cadastrando?
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as ProductType)}
          disabled={saving}
        >
          <option value={PRODUCT_TYPES.PRODUCT}>Produto (com estoque)</option>
          <option value={PRODUCT_TYPES.DOSE}>Dose / taça</option>
          <option value={PRODUCT_TYPES.MEAL}>Refeição / prato</option>
          <option value={PRODUCT_TYPES.SERVICE}>Serviço</option>
        </select>
      </label>

      {type === PRODUCT_TYPES.DOSE && (
        <div className="product-form__guide" role="note">
          <strong>Como cadastrar dose (2 passos)</strong>
          <ol>
            <li>
              Cadastre a <em>garrafa</em> como <strong>Produto</strong> (ex.: Vinho 750 ml), com
              estoque.
            </li>
            <li>
              Depois volte aqui, escolha <strong>Dose / taça</strong>, diga de qual garrafa sai e
              quantos ml tem cada dose.
            </li>
          </ol>
          {baseCatalog.length === 0 && (
            <p className="product-form__guide-warn">
              Ainda não há garrafa cadastrada. Salve esta tela, cadastre o produto da bebida e
              volte para criar a dose.
            </p>
          )}
        </div>
      )}

      <section className="product-form__barcode-block">
        <h3>Identificação e código de barras</h3>

        {hasCode && !editingCode ? (
          <div className="product-form__barcode-view">
            <p className="product-form__barcode-value">{barcode}</p>
            {barcodeMeta && (
              <p className="product-form__barcode-meta">
                Tipo: {BARCODE_TYPE_LABELS[barcodeMeta.type]} · Origem:{' '}
                {BARCODE_SOURCE_LABELS[barcodeMeta.source]}
              </p>
            )}
            <div className="product-form__barcode-actions">
              {canPrint && onPrintLabel && (
                <button type="button" onClick={onPrintLabel} disabled={saving}>
                  Imprimir etiqueta
                </button>
              )}
              {canChange && (
                <button type="button" onClick={requestChangeCode} disabled={saving}>
                  Alterar código
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <label className="product-form__barcode">
              Código de barras
              <div className="product-form__barcode-input-row">
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value)
                    setBarcodeMeta(undefined)
                    if (lookupStatus !== 'idle') setLookupStatus('idle')
                  }}
                  onKeyDown={onBarcodeKeyDown}
                  onBlur={() => {
                    if (barcode.trim() && lookupStatus === 'idle') {
                      resolveBarcode(barcode)
                    }
                  }}
                  disabled={saving}
                  placeholder="Escaneie ou digite e pressione Enter"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="product-form__scan-btn product-form__phone-only"
                  title="Ler código com a câmera"
                  aria-label="Ler código com a câmera"
                  disabled={saving}
                  onClick={openBarcodeScanner}
                >
                  <ScanLine size={20} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </label>
            <div className="product-form__barcode-actions">
              <button
                type="button"
                className="product-form__phone-only"
                onClick={openBarcodeScanner}
                disabled={saving}
              >
                <ScanLine size={15} strokeWidth={2} aria-hidden />
                Ler código
              </button>
              {canGenerate && (
                <button type="button" onClick={() => void handleGenerateCode()} disabled={saving}>
                  Gerar código BALQO
                </button>
              )}
            </div>
          </>
        )}

        {generateNotice && (
          <p className="product-form__banner product-form__banner--found" role="status">
            {generateNotice}
          </p>
        )}
      </section>

      {lookupStatus === 'found' && (
        <p className="product-form__banner product-form__banner--found" role="status">
          Item encontrado. Ajuste os dados se precisar e salve.
        </p>
      )}
      {lookupStatus === 'new' && (
        <p className="product-form__banner product-form__banner--new" role="status">
          Código novo. Preencha os dados para cadastrar.
        </p>
      )}

      <div className="product-form__grid">
        <label className="product-form__full">
          Nome
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(formatProductTextInput(e.target.value))}
            disabled={saving}
            required
          />
        </label>

        {type !== PRODUCT_TYPES.DOSE && (
          <>
            <label>
              Custo (R$)
              <input
                value={cost}
                onChange={(e) => onCostChange(e.target.value)}
                disabled={saving}
                placeholder="0,00"
              />
            </label>

            <label>
              Margem %
              <input
                inputMode="decimal"
                value={markupPercent}
                onChange={(e) => onMarkupChange(e.target.value)}
                disabled={saving}
                placeholder="40"
                aria-label="Margem percentual sobre o custo"
              />
            </label>
          </>
        )}

        <label className="product-form__full">
          Preço de venda (R$)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={saving}
            placeholder="0,00"
            required
          />
          {type === PRODUCT_TYPES.DOSE ? (
            <span className="product-form__field-hint">
              {doseCostPreview > 0
                ? `Custo estimado pela garrafa: ${formatMoney(doseCostPreview)} (não precisa informar)`
                : 'O custo sai automaticamente da garrafa (informe o custo nela).'}
            </span>
          ) : (
            parseMoneyToCents(cost) > 0 && (
              <span className="product-form__field-hint">
                Calculado pelo custo + margem (pode editar)
              </span>
            )
          )}
        </label>

        <label>
          Fila do salão
          <select
            value={prepStation}
            onChange={(e) => setPrepStation(e.target.value as PrepStation)}
            disabled={saving}
          >
            {(Object.keys(PREP_STATION_LABELS) as PrepStation[]).map((key) => (
              <option key={key} value={key}>
                {PREP_STATION_LABELS[key]}
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

        {type === PRODUCT_TYPES.PRODUCT && unit === 'UN' && (
          <label className="product-form__full">
            ml por garrafa (só se for vender doses)
            <input
              type="number"
              min={1}
              step="any"
              value={contentMl}
              onChange={(e) => setContentMl(e.target.value)}
              disabled={saving}
              placeholder="Ex.: 750"
            />
            <span className="product-form__field-hint">
              Ex.: garrafa de 750 ml. Deixe vazio se não for usar doses.
            </span>
          </label>
        )}

        {type === PRODUCT_TYPES.PRODUCT && unit === 'ML' && (
          <p className="product-form__field-hint product-form__full">
            Dica: estoque em ML = ml totais (ex.: 1 garrafa de 750 → estoque 750).
          </p>
        )}

        {type === PRODUCT_TYPES.DOSE && (
          <div className="product-form__dose product-form__full">
            <label>
              De qual garrafa sai esta dose?
              <select
                value={doseBaseProductId}
                onChange={(e) => setDoseBaseProductId(e.target.value)}
                disabled={saving || baseCatalog.length === 0}
                required
              >
                <option value="">
                  {baseCatalog.length === 0
                    ? 'Cadastre a garrafa primeiro…'
                    : 'Escolha a bebida / garrafa'}
                </option>
                {baseCatalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.contentMl
                      ? ` (${item.contentMl} ml)`
                      : item.unit === 'ML' || item.unit === 'L'
                        ? ` (${item.unit})`
                        : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantos ml tem esta dose?
              <input
                type="number"
                min={1}
                step="any"
                value={doseMl}
                onChange={(e) => setDoseMl(e.target.value)}
                disabled={saving}
                placeholder="Ex.: 50 (dose) ou 150 (taça)"
                required
              />
            </label>
            <button
              type="button"
              className="product-form__dose-advanced-toggle"
              onClick={() => setShowDoseAdvanced((open) => !open)}
            >
              {showDoseAdvanced ? 'Ocultar ajuste fino' : 'Ajuste fino (opcional)'}
            </button>
            {showDoseAdvanced && (
              <label>
                Rendimento % (padrão 90)
                <input
                  type="number"
                  min={1}
                  max={100}
                  step="any"
                  value={doseYieldPercent}
                  onChange={(e) => setDoseYieldPercent(e.target.value)}
                  disabled={saving}
                />
                <span className="product-form__field-hint">
                  Compensa variação na hora de servir. Na dúvida, deixe 90.
                </span>
              </label>
            )}
          </div>
        )}

        <div className="product-form__category">
          <span className="product-form__category-label">Categoria</span>
          <div className="product-form__category-row">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving || categoryBusy}
              aria-label="Categoria"
            >
              <option value="">Sem categoria</option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
              {category &&
                !categories.some((item) => item.name === category) && (
                  <option value={category}>{category}</option>
                )}
            </select>
            <button
              type="button"
              className="product-form__category-add"
              title="Nova categoria"
              aria-label="Nova categoria"
              disabled={saving || categoryBusy}
              onClick={() => {
                setShowQuickCategory((open) => !open)
                setQuickCategoryName('')
              }}
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {showQuickCategory && (
            <div className="product-form__category-quick">
              <input
                ref={quickCategoryRef}
                value={quickCategoryName}
                onChange={(e) => setQuickCategoryName(formatProductTextInput(e.target.value))}
                placeholder="Nome da categoria"
                disabled={saving || categoryBusy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleQuickCreateCategory()
                  }
                  if (e.key === 'Escape') {
                    setShowQuickCategory(false)
                    setQuickCategoryName('')
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleQuickCreateCategory()}
                disabled={saving || categoryBusy || !normalizeProductText(quickCategoryName)}
              >
                {categoryBusy ? '…' : 'OK'}
              </button>
            </div>
          )}
        </div>

        {tracksStock && (
          <label className="product-form__stock">
            {Number(contentMl) > 0 && unit === 'UN'
              ? 'Garrafas cheias'
              : 'Quantidade / estoque'}
            <input
              ref={stockRef}
              type="number"
              min={0}
              step={Number(contentMl) > 0 && unit === 'UN' ? 1 : 'any'}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={saving}
            />
            {initial && usesBottleStockModel(initial) && (
              <span className="product-form__field-hint">
                Agora: {formatProductStockLabel(initial, stockCatalog)}. A garrafa aberta muda só
                nas vendas de dose.
              </span>
            )}
          </label>
        )}

        {tracksStock && (
          <label>
            Estoque mínimo
            <input
              type="number"
              min={0}
              step="any"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              disabled={saving}
            />
          </label>
        )}

        <label className="product-form__check">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={saving}
          />
          Ativo no PDV
        </label>
      </div>

      {localError && (
        <p className="product-form__error" role="alert">
          {localError}
        </p>
      )}

      <footer className="product-form__actions">
        <button type="button" className="product-form__secondary" onClick={onCancel} disabled={saving}>
          Voltar
        </button>
        <button type="submit" className="product-form__primary" disabled={saving}>
          {saving ? 'Salvando…' : lookupStatus === 'found' || initial ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </footer>

      {showBarcodeScanner && (
        <PosBarcodeScanner
          onDetect={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </form>
  )
}
