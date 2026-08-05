import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { formatMoney, parseMoneyToCents } from '../../../shared/lib/money'
import {
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  type Product,
  type ProductInput,
  type ProductUnit,
} from '../types'
import './ProductForm.css'

interface ProductFormProps {
  initial?: Product | null
  saving: boolean
  findByBarcode: (barcode: string) => Product | null
  onResolvedProduct: (product: Product | null) => void
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function fillFromProduct(
  product: Product | null,
  setters: {
    setName: (v: string) => void
    setBarcode: (v: string) => void
    setCategory: (v: string) => void
    setUnit: (v: ProductUnit) => void
    setType: (v: Product['type']) => void
    setPrice: (v: string) => void
    setCost: (v: string) => void
    setStock: (v: string) => void
    setMinStock: (v: string) => void
    setActive: (v: boolean) => void
  },
  keepBarcode?: string,
) {
  if (!product) {
    setters.setName('')
    setters.setBarcode(keepBarcode ?? '')
    setters.setCategory('')
    setters.setUnit('UN')
    setters.setType(PRODUCT_TYPES.PRODUCT)
    setters.setPrice('')
    setters.setCost('')
    setters.setStock('0')
    setters.setMinStock('0')
    setters.setActive(true)
    return
  }

  setters.setName(product.name)
  setters.setBarcode(product.barcode ?? keepBarcode ?? '')
  setters.setCategory(product.category ?? '')
  setters.setUnit(product.unit)
  setters.setType(product.type)
  setters.setPrice(centsToInput(product.priceCents))
  setters.setCost(centsToInput(product.costCents))
  setters.setStock(String(product.stock ?? 0))
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
}: ProductFormProps) {
  const barcodeRef = useRef<HTMLInputElement>(null)
  const stockRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [unit, setUnit] = useState<ProductUnit>(initial?.unit ?? 'UN')
  const [type, setType] = useState(initial?.type ?? PRODUCT_TYPES.PRODUCT)
  const [price, setPrice] = useState(initial ? centsToInput(initial.priceCents) : '')
  const [cost, setCost] = useState(initial ? centsToInput(initial.costCents) : '')
  const [stock, setStock] = useState(String(initial?.stock ?? 0))
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? 0))
  const [active, setActive] = useState(initial?.active ?? true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'found' | 'new'>('idle')

  const setters = {
    setName,
    setBarcode,
    setCategory,
    setUnit,
    setType,
    setPrice,
    setCost,
    setStock,
    setMinStock,
    setActive,
  }

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setBarcode(initial.barcode ?? '')
      setCategory(initial.category ?? '')
      setUnit(initial.unit)
      setType(initial.type)
      setPrice(centsToInput(initial.priceCents))
      setCost(centsToInput(initial.costCents))
      setStock(String(initial.stock ?? 0))
      setMinStock(String(initial.minStock ?? 0))
      setActive(initial.active)
      setLookupStatus('found')
    } else {
      setName('')
      setBarcode('')
      setCategory('')
      setUnit('UN')
      setType(PRODUCT_TYPES.PRODUCT)
      setPrice('')
      setCost('')
      setStock('0')
      setMinStock('0')
      setActive(true)
      setLookupStatus('idle')
      barcodeRef.current?.focus()
    }
    setLocalError(null)
  }, [initial])

  function resolveBarcode(code: string) {
    const trimmed = code.trim()
    setLocalError(null)

    if (!trimmed) {
      setLookupStatus('idle')
      onResolvedProduct(null)
      return
    }

    const found = findByBarcode(trimmed)
    if (found) {
      fillFromProduct(found, setters)
      setLookupStatus('found')
      onResolvedProduct(found)
      requestAnimationFrame(() => {
        stockRef.current?.focus()
        stockRef.current?.select()
      })
      return
    }

    fillFromProduct(null, setters, trimmed)
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

    const input: ProductInput = {
      name,
      barcode,
      category,
      unit,
      type,
      priceCents,
      costCents: parseMoneyToCents(cost),
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      active,
    }

    try {
      await onSubmit(input)
    } catch {
      setLocalError('Falha ao salvar. Tente novamente.')
    }
  }

  const isService = type === PRODUCT_TYPES.SERVICE
  const title =
    lookupStatus === 'found' || initial
      ? 'Atualizar produto'
      : lookupStatus === 'new'
        ? 'Novo produto'
        : 'Cadastrar / atualizar'

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <header className="product-form__header">
        <div>
          <h2>{title}</h2>
          <p className="product-form__lead">
            Passe o código primeiro. Se o produto existir, ajuste a quantidade e salve.
          </p>
        </div>
        {initial && (
          <span className="product-form__price-hint">{formatMoney(initial.priceCents)}</span>
        )}
      </header>

      <label className="product-form__barcode">
        Código de barras
        <input
          ref={barcodeRef}
          value={barcode}
          onChange={(e) => {
            setBarcode(e.target.value)
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
      </label>

      {lookupStatus === 'found' && (
        <p className="product-form__banner product-form__banner--found" role="status">
          Produto encontrado. Altere a quantidade (estoque) se precisar e salve.
        </p>
      )}
      {lookupStatus === 'new' && (
        <p className="product-form__banner product-form__banner--new" role="status">
          Código novo. Preencha os dados para cadastrar.
        </p>
      )}

      <div className="product-form__grid">
        {!isService && (
          <label className="product-form__stock">
            Quantidade / estoque
            <input
              ref={stockRef}
              type="number"
              min={0}
              step="any"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={saving}
            />
          </label>
        )}

        <label className={isService ? 'product-form__full' : undefined}>
          Nome
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
          />
        </label>

        <label>
          Preço de venda (R$)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={saving}
            placeholder="0,00"
            required
          />
        </label>

        <label>
          Custo (R$)
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            disabled={saving}
            placeholder="0,00"
          />
        </label>

        <label>
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Product['type'])}
            disabled={saving}
          >
            <option value={PRODUCT_TYPES.PRODUCT}>Produto</option>
            <option value={PRODUCT_TYPES.SERVICE}>Serviço</option>
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

        <label>
          Categoria
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={saving}
            placeholder="Ex.: Bebidas"
          />
        </label>

        {!isService && (
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
    </form>
  )
}
