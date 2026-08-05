import { useMemo, useState, type CSSProperties } from 'react'
import { formatMoney } from '../../../shared/lib/money'
import { BarcodeSvg } from './BarcodeSvg'
import {
  DEFAULT_LABEL_DISPLAY,
  LABEL_MODELS,
  type LabelDisplayOptions,
  type LabelModelId,
  type LabelPrintItem,
} from '../types'
import './LabelPrintModal.css'

interface LabelPrintModalProps {
  storeName?: string
  items: LabelPrintItem[]
  onChangeQuantity: (productId: string, quantity: number) => void
  onUseStockQuantities?: () => void
  onClose: () => void
  onPrinted?: (info: { modelId: LabelModelId; totalLabels: number }) => void
}

export function LabelPrintModal({
  storeName,
  items,
  onChangeQuantity,
  onUseStockQuantities,
  onClose,
  onPrinted,
}: LabelPrintModalProps) {
  const [modelId, setModelId] = useState<LabelModelId>('50x30')
  const [display, setDisplay] = useState<LabelDisplayOptions>({ ...DEFAULT_LABEL_DISPLAY })
  const [step, setStep] = useState<'config' | 'preview'>('config')

  const model = LABEL_MODELS[modelId]
  const totalLabels = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const printable = useMemo(
    () => items.filter((item) => item.barcode.trim() && item.quantity > 0),
    [items],
  )

  function toggle(key: keyof LabelDisplayOptions) {
    setDisplay((current) => ({ ...current, [key]: !current[key] }))
  }

  function handlePrint() {
    onPrinted?.({ modelId, totalLabels })
    window.print()
  }

  return (
    <div className="label-print-modal" role="dialog" aria-modal="true">
      <div className="label-print-modal__backdrop" onClick={onClose} />
      <section className="label-print-modal__panel">
        <header className="label-print-modal__header">
          <div>
            <h2>{step === 'config' ? 'Imprimir etiquetas' : 'Pré-visualização'}</h2>
            <p>
              {totalLabels} etiqueta(s) · gerar código e imprimir são ações separadas
            </p>
          </div>
          <button type="button" className="label-print-modal__close" onClick={onClose}>
            Fechar
          </button>
        </header>

        {step === 'config' ? (
          <>
            <div className="label-print-modal__items">
              {items.map((item) => (
                <div key={item.productId} className="label-print-modal__row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.barcode || 'Sem código'}</span>
                  </div>
                  <label>
                    Qtd.
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={item.quantity}
                      onChange={(e) =>
                        onChangeQuantity(item.productId, Math.max(0, Number(e.target.value) || 0))
                      }
                      disabled={!item.barcode}
                    />
                  </label>
                </div>
              ))}
            </div>

            {onUseStockQuantities && (
              <button
                type="button"
                className="label-print-modal__ghost"
                onClick={onUseStockQuantities}
              >
                Usar quantidade em estoque
              </button>
            )}

            <fieldset className="label-print-modal__fieldset">
              <legend>Modelo</legend>
              {(Object.keys(LABEL_MODELS) as LabelModelId[]).map((id) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="label-model"
                    checked={modelId === id}
                    onChange={() => setModelId(id)}
                  />
                  {LABEL_MODELS[id].label}
                </label>
              ))}
            </fieldset>

            <fieldset className="label-print-modal__fieldset">
              <legend>Exibir</legend>
              <label>
                <input type="checkbox" checked={display.showName} onChange={() => toggle('showName')} />
                Nome do produto
              </label>
              <label>
                <input type="checkbox" checked={display.showPrice} onChange={() => toggle('showPrice')} />
                Preço
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={display.showBarcode}
                  onChange={() => toggle('showBarcode')}
                />
                Código de barras
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={display.showBarcodeText}
                  onChange={() => toggle('showBarcodeText')}
                />
                Número abaixo do código
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={display.showStoreName}
                  onChange={() => toggle('showStoreName')}
                />
                Nome do comércio
              </label>
              <label>
                <input type="checkbox" checked={display.showUnit} onChange={() => toggle('showUnit')} />
                Unidade
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={display.showPrintDate}
                  onChange={() => toggle('showPrintDate')}
                />
                Data de impressão
              </label>
            </fieldset>

            <div className="label-print-modal__actions">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="label-print-modal__primary"
                disabled={printable.length === 0}
                onClick={() => setStep('preview')}
              >
                Pré-visualizar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="label-print-modal__preview-wrap">
              <div
                className={`label-print-sheet label-print-sheet--${modelId}`}
                style={
                  {
                    '--label-w': `${model.widthMm}mm`,
                    '--label-h': `${model.heightMm}mm`,
                  } as CSSProperties
                }
              >
                {printable.flatMap((item) =>
                  Array.from({ length: item.quantity }, (_, index) => (
                    <article key={`${item.productId}-${index}`} className="label-print-card">
                      {display.showStoreName && storeName ? (
                        <p className="label-print-card__store">{storeName}</p>
                      ) : null}
                      {display.showName ? (
                        <h3 className="label-print-card__name">{item.name}</h3>
                      ) : null}
                      {display.showUnit ? (
                        <p className="label-print-card__unit">{item.unit}</p>
                      ) : null}
                      {display.showPrice ? (
                        <p className="label-print-card__price">{formatMoney(item.priceCents)}</p>
                      ) : null}
                      {display.showBarcode ? (
                        <div className="label-print-card__barcode">
                          <BarcodeSvg
                            value={item.barcode}
                            height={modelId === '40x25' ? 28 : 40}
                            displayValue={false}
                          />
                        </div>
                      ) : null}
                      {display.showBarcodeText ? (
                        <p className="label-print-card__code">{item.barcode}</p>
                      ) : null}
                      {display.showPrintDate ? (
                        <p className="label-print-card__date">
                          {new Date().toLocaleDateString('pt-BR')}
                        </p>
                      ) : null}
                    </article>
                  )),
                )}
              </div>
            </div>

            <div className="label-print-modal__actions">
              <button type="button" onClick={() => setStep('config')}>
                Voltar
              </button>
              <button
                type="button"
                className="label-print-modal__primary"
                onClick={handlePrint}
              >
                Imprimir etiquetas
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
