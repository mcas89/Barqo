import { useState, type FormEvent } from 'react'
import type { Product } from '../../products'
import './StockMoveForm.css'

export type StockMoveMode = 'entry' | 'loss' | 'adjustment'

interface StockMoveFormProps {
  product: Product
  mode: StockMoveMode
  saving: boolean
  onSubmit: (value: { quantity?: number; newStock?: number; note: string }) => Promise<void>
  onCancel: () => void
}

const TITLES: Record<StockMoveMode, string> = {
  entry: 'Entrada de estoque',
  loss: 'Perda / saída',
  adjustment: 'Ajuste por contagem',
}

export function StockMoveForm({
  product,
  mode,
  saving,
  onSubmit,
  onCancel,
}: StockMoveFormProps) {
  const [quantity, setQuantity] = useState('')
  const [newStock, setNewStock] = useState(String(product.stock))
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    try {
      if (mode === 'adjustment') {
        const value = Number(newStock)
        if (!Number.isFinite(value) || value < 0) {
          setLocalError('Informe o saldo contado (0 ou mais).')
          return
        }
        await onSubmit({ newStock: value, note })
      } else {
        const value = Number(quantity)
        if (!Number.isFinite(value) || value <= 0) {
          setLocalError('Informe uma quantidade maior que zero.')
          return
        }
        await onSubmit({ quantity: value, note })
      }
    } catch {
      // erro no hook
    }
  }

  return (
    <form className="stock-move-form" onSubmit={(e) => void handleSubmit(e)}>
      <header>
        <h2>{TITLES[mode]}</h2>
        <p>
          <strong>{product.name}</strong> · saldo atual: {product.stock} {product.unit}
        </p>
      </header>

      {mode === 'adjustment' ? (
        <label>
          Novo saldo (contagem)
          <input
            inputMode="numeric"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value.replace(/[^\d]/g, ''))}
            disabled={saving}
            autoFocus
            required
          />
        </label>
      ) : (
        <label>
          Quantidade
          <input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
            disabled={saving}
            autoFocus
            required
            placeholder="0"
          />
        </label>
      )}

      <label>
        Observação (opcional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
          placeholder={
            mode === 'entry'
              ? 'Ex.: compra, NF 123'
              : mode === 'loss'
                ? 'Ex.: vencido, quebrado'
                : 'Ex.: inventário mensal'
          }
        />
      </label>

      {localError && (
        <p className="stock-move-form__error" role="alert">
          {localError}
        </p>
      )}

      <div className="stock-move-form__actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}
