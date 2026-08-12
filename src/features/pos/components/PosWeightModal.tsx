import { useEffect, useRef, useState, type FormEvent } from 'react'
import './PosWeightModal.css'

/** Converte "0,350" / "0.350" / "1,5" em número > 0. */
export function parseWeightInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 1000) / 1000
}

export function formatWeightLabel(weight: number, unit: string): string {
  return `${weight.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit.toLowerCase()}`
}

type Props = {
  productName: string
  unit: string
  unitPriceCents: number
  maxStock?: number
  busy?: boolean
  onConfirm: (weight: number) => void
  onCancel: () => void
}

export function PosWeightModal({
  productName,
  unit,
  unitPriceCents,
  maxStock,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const weight = parseWeightInput(draft)
  const lineTotal =
    weight != null ? Math.round(unitPriceCents * weight) : null

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = parseWeightInput(draft)
    if (next == null) {
      setError(`Informe o peso em ${unit.toLowerCase()}.`)
      return
    }
    if (maxStock != null && next > maxStock + 1e-9) {
      setError(`Estoque disponível: ${formatWeightLabel(maxStock, unit)}.`)
      return
    }
    onConfirm(next)
  }

  return (
    <div className="pos-weight" role="dialog" aria-modal="true" aria-labelledby="pos-weight-title">
      <button type="button" className="pos-weight__backdrop" aria-label="Fechar" onClick={onCancel} />
      <form className="pos-weight__card" onSubmit={submit}>
        <p className="pos-weight__eyebrow">Venda a granel</p>
        <h2 id="pos-weight-title">{productName}</h2>
        <p className="pos-weight__meta">
          Preço por {unit.toLowerCase()}:{' '}
          {(unitPriceCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </p>
        <label>
          Peso ({unit.toLowerCase()})
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            placeholder="0,000"
            inputMode="decimal"
            disabled={busy}
            autoComplete="off"
          />
        </label>
        {lineTotal != null ? (
          <p className="pos-weight__total">
            Total:{' '}
            <strong>
              {(lineTotal / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </p>
        ) : null}
        {error ? (
          <p className="pos-weight__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pos-weight__actions">
          <button type="button" className="pos-weight__ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="pos-weight__ok" disabled={busy}>
            Incluir
          </button>
        </div>
      </form>
    </div>
  )
}
