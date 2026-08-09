import { useMemo, useState, type CSSProperties } from 'react'
import { formatMoney } from '../../../shared/lib/money'
import { BarcodeSvg } from './BarcodeSvg'
import {
  A4_PAGE,
  DEFAULT_LABEL_DISPLAY,
  LABEL_PAPERS,
  LABEL_SIZES,
  a4GridForSize,
  buildPrintModelId,
  type LabelDisplayOptions,
  type LabelPaperId,
  type LabelPrintItem,
  type LabelSizeId,
} from '../types'
import './LabelPrintModal.css'

interface LabelPrintModalProps {
  storeName?: string
  items: LabelPrintItem[]
  onChangeQuantity: (productId: string, quantity: number) => void
  onUseStockQuantities?: () => void
  onClose: () => void
  onPrinted?: (info: { modelId: string; totalLabels: number }) => void
}

function expandLabels(items: LabelPrintItem[]) {
  return items
    .filter((item) => item.barcode.trim() && item.quantity > 0)
    .flatMap((item) =>
      Array.from({ length: item.quantity }, (_, index) => ({
        ...item,
        key: `${item.productId}-${index}`,
      })),
    )
}

export function LabelPrintModal({
  storeName,
  items,
  onChangeQuantity,
  onUseStockQuantities,
  onClose,
  onPrinted,
}: LabelPrintModalProps) {
  const [sizeId, setSizeId] = useState<LabelSizeId>('50x30')
  const [paperId, setPaperId] = useState<LabelPaperId>('a4')
  const [display, setDisplay] = useState<LabelDisplayOptions>({ ...DEFAULT_LABEL_DISPLAY })
  const [step, setStep] = useState<'config' | 'preview'>('config')

  const size = LABEL_SIZES[sizeId]
  const a4Grid = useMemo(() => a4GridForSize(sizeId), [sizeId])
  const totalLabels = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const printable = useMemo(() => expandLabels(items), [items])
  const a4Pages = useMemo(() => {
    if (paperId !== 'a4') return [printable]
    const pages: (typeof printable)[] = []
    for (let i = 0; i < printable.length; i += a4Grid.perPage) {
      pages.push(printable.slice(i, i + a4Grid.perPage))
    }
    return pages.length > 0 ? pages : [[]]
  }, [printable, paperId, a4Grid.perPage])

  function toggle(key: keyof LabelDisplayOptions) {
    setDisplay((current) => ({ ...current, [key]: !current[key] }))
  }

  function handlePrint() {
    onPrinted?.({
      modelId: buildPrintModelId(paperId, sizeId),
      totalLabels,
    })
    window.print()
  }

  const sheetStyle = {
    '--label-w': `${size.widthMm}mm`,
    '--label-h': `${size.heightMm}mm`,
    '--a4-cols': String(a4Grid.columns),
    '--a4-rows': String(a4Grid.rows),
    '--a4-gap-x': `${a4Grid.gapXMm}mm`,
    '--a4-gap-y': `${a4Grid.gapYMm}mm`,
    '--a4-margin': `${A4_PAGE.marginMm}mm`,
  } as CSSProperties

  return (
    <div className="label-print-modal" role="dialog" aria-modal="true">
      <div className="label-print-modal__backdrop" onClick={onClose} />
      <section className="label-print-modal__panel">
        <header className="label-print-modal__header">
          <div>
            <h2>{step === 'config' ? 'Imprimir etiquetas' : 'Pré-visualização'}</h2>
            <p>
              {totalLabels} etiqueta(s)
              {paperId === 'a4'
                ? ` · ~${a4Grid.perPage}/folha A4 (${a4Grid.columns}×${a4Grid.rows})`
                : ` · ${size.label}`}
            </p>
          </div>
          <button type="button" className="label-print-modal__close" onClick={onClose}>
            Fechar
          </button>
        </header>

        {step === 'config' ? (
          <>
            <p className="label-print-modal__hint">
              Em <strong>Qtd.</strong>, informe quantas cópias de cada produto. Ex.: estoque 10 →
              digite 10, ou use o botão abaixo.
            </p>

            <div className="label-print-modal__items">
              {items.map((item) => (
                <div key={item.productId} className="label-print-modal__row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.barcode || 'Sem código'}</span>
                  </div>
                  <label>
                    Qtd. de etiquetas
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={item.quantity}
                      onChange={(e) =>
                        onChangeQuantity(item.productId, Math.max(0, Number(e.target.value) || 0))
                      }
                      disabled={!item.barcode}
                      aria-label={`Quantidade de etiquetas de ${item.name}`}
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
              <legend>Papel</legend>
              {(Object.keys(LABEL_PAPERS) as LabelPaperId[]).map((id) => (
                <label key={id} className="label-print-modal__choice">
                  <input
                    type="radio"
                    name="label-paper"
                    checked={paperId === id}
                    onChange={() => setPaperId(id)}
                  />
                  <span>
                    <strong>{LABEL_PAPERS[id].label}</strong>
                    <small>{LABEL_PAPERS[id].hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="label-print-modal__fieldset">
              <legend>Tamanho da etiqueta</legend>
              {(Object.keys(LABEL_SIZES) as LabelSizeId[]).map((id) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="label-size"
                    checked={sizeId === id}
                    onChange={() => setSizeId(id)}
                  />
                  {LABEL_SIZES[id].label}
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
              {a4Pages.map((page, pageIndex) => (
                <div
                  key={`page-${pageIndex}`}
                  className={`label-print-sheet label-print-sheet--${paperId} ${
                    pageIndex > 0 ? 'label-print-sheet--break' : ''
                  }`}
                  style={sheetStyle}
                >
                  {page.map((item) => (
                    <article key={item.key} className="label-print-card">
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
                            height={size.barcodeHeight}
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
                  ))}
                </div>
              ))}
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
