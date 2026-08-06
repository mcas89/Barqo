import { useEffect, useState, type FormEvent } from 'react'
import { formatProductTextInput } from '../../products/types'
import { parseMoneyToCents } from '../../../shared/lib/money'
import './PosQuickItemPanel.css'

export type QuickItemMode = 'register' | 'loose'

export function PosQuickItemPanel({
  mode,
  initialName = '',
  initialBarcode = '',
  busy,
  error,
  onModeChange,
  onRegister,
  onLoose,
  onClose,
}: {
  mode: QuickItemMode
  initialName?: string
  initialBarcode?: string
  busy?: boolean
  error?: string | null
  onModeChange: (mode: QuickItemMode) => void
  onRegister: (input: {
    name: string
    unitPriceCents: number
    barcode?: string
    stock: number
    quantity: number
  }) => Promise<boolean>
  onLoose: (input: { name: string; unitPriceCents: number; quantity: number }) => boolean
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [barcode, setBarcode] = useState(initialBarcode)
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [stock, setStock] = useState('1')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setName(initialName)
    setBarcode(initialBarcode)
  }, [initialName, initialBarcode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    const unitPriceCents = parseMoneyToCents(price)
    const qty = Math.max(1, Number.parseInt(quantity, 10) || 1)
    if (!name.trim()) {
      setLocalError(mode === 'loose' ? 'Informe a descrição.' : 'Informe o nome do produto.')
      return
    }
    if (unitPriceCents <= 0) {
      setLocalError('Informe o preço.')
      return
    }

    if (mode === 'loose') {
      const ok = onLoose({ name, unitPriceCents, quantity: qty })
      if (ok) onClose()
      return
    }

    const stockQty = Math.max(qty, Number.parseInt(stock, 10) || qty)
    const ok = await onRegister({
      name,
      unitPriceCents,
      barcode: barcode.trim() || undefined,
      stock: stockQty,
      quantity: qty,
    })
    if (ok) onClose()
  }

  return (
    <div className="pos-quick">
      <button type="button" className="pos-quick__backdrop" aria-label="Fechar" onClick={onClose} />
      <form className="pos-quick__card" onSubmit={(event) => void handleSubmit(event)}>
        <header>
          <h2>{mode === 'loose' ? 'Venda avulsa' : 'Cadastro rápido'}</h2>
          <button type="button" onClick={onClose} disabled={busy}>
            Fechar
          </button>
        </header>

        <div className="pos-quick__tabs">
          <button
            type="button"
            className={mode === 'register' ? 'pos-quick__tab pos-quick__tab--active' : 'pos-quick__tab'}
            onClick={() => onModeChange('register')}
            disabled={busy}
          >
            Cadastrar
          </button>
          <button
            type="button"
            className={mode === 'loose' ? 'pos-quick__tab pos-quick__tab--active' : 'pos-quick__tab'}
            onClick={() => onModeChange('loose')}
            disabled={busy}
          >
            Avulsa
          </button>
        </div>

        <p className="pos-quick__hint">
          {mode === 'loose'
            ? 'Entra só nesta venda. Não grava no catálogo nem baixa estoque.'
            : 'Grava no catálogo e já coloca no carrinho.'}
        </p>

        <label>
          {mode === 'loose' ? 'Descrição' : 'Nome'}
          <input
            value={name}
            onChange={(event) => setName(formatProductTextInput(event.target.value))}
            disabled={busy}
            autoFocus
            placeholder={mode === 'loose' ? 'ITEM AVULSO' : 'NOME DO PRODUTO'}
          />
        </label>

        {mode === 'register' && (
          <label>
            Código de barras (opcional)
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              disabled={busy}
              placeholder="Se passou o leitor, já vem preenchido"
            />
          </label>
        )}

        <div
          className={
            mode === 'register' ? 'pos-quick__row pos-quick__row--with-stock' : 'pos-quick__row'
          }
        >
          <label>
            Preço
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={busy}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <label>
            Qtd
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, '').slice(0, 4) || '1')}
              disabled={busy}
              inputMode="numeric"
            />
          </label>
          {mode === 'register' && (
            <label>
              Estoque
              <input
                value={stock}
                onChange={(event) => setStock(event.target.value.replace(/\D/g, '').slice(0, 5) || '1')}
                disabled={busy}
                inputMode="numeric"
              />
            </label>
          )}
        </div>

        {(localError || error) && (
          <p className="pos-quick__error" role="alert">
            {localError || error}
          </p>
        )}

        <button type="submit" className="pos-quick__submit" disabled={busy}>
          {busy ? 'Salvando…' : mode === 'loose' ? 'Colocar na venda' : 'Cadastrar e vender'}
        </button>
      </form>
    </div>
  )
}
