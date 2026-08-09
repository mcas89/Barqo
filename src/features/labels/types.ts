/** Tamanhos da etiqueta individual (conteúdo impresso). */
export const LABEL_SIZES = {
  '40x25': {
    id: '40x25',
    label: '40 × 25 mm',
    widthMm: 40,
    heightMm: 25,
    barcodeHeight: 28,
  },
  '50x30': {
    id: '50x30',
    label: '50 × 30 mm',
    widthMm: 50,
    heightMm: 30,
    barcodeHeight: 40,
  },
  '60x40': {
    id: '60x40',
    label: '60 × 40 mm',
    widthMm: 60,
    heightMm: 40,
    barcodeHeight: 44,
  },
} as const

export type LabelSizeId = keyof typeof LABEL_SIZES

/** Papel / mídia de impressão. */
export const LABEL_PAPERS = {
  roll: {
    id: 'roll',
    label: 'Rolo / impressora de etiquetas',
    hint: 'Uma etiqueta atrás da outra, no tamanho escolhido.',
  },
  a4: {
    id: 'a4',
    label: 'Folha A4',
    hint: 'Várias etiquetas na mesma folha A4 (impressora comum).',
  },
} as const

export type LabelPaperId = keyof typeof LABEL_PAPERS

/** @deprecated Prefer LabelSizeId + LabelPaperId. Mantido p/ audit legado. */
export const LABEL_MODELS = {
  ...LABEL_SIZES,
  a4: {
    id: 'a4',
    label: 'Folha A4',
    widthMm: 210,
    heightMm: 297,
  },
} as const

export type LabelModelId = keyof typeof LABEL_MODELS

export interface LabelDisplayOptions {
  showName: boolean
  showPrice: boolean
  showBarcode: boolean
  showBarcodeText: boolean
  showStoreName: boolean
  showUnit: boolean
  showPrintDate: boolean
}

export const DEFAULT_LABEL_DISPLAY: LabelDisplayOptions = {
  showName: true,
  showPrice: true,
  showBarcode: true,
  showBarcodeText: true,
  showStoreName: false,
  showUnit: false,
  showPrintDate: false,
}

export interface LabelPrintItem {
  productId: string
  name: string
  barcode: string
  priceCents: number
  unit: string
  quantity: number
}

/** Margens úteis da folha A4 (mm). */
export const A4_PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 5,
} as const

export function a4GridForSize(sizeId: LabelSizeId): {
  columns: number
  rows: number
  perPage: number
  gapXMm: number
  gapYMm: number
} {
  const size = LABEL_SIZES[sizeId]
  const usableW = A4_PAGE.widthMm - A4_PAGE.marginMm * 2
  const usableH = A4_PAGE.heightMm - A4_PAGE.marginMm * 2
  const columns = Math.max(1, Math.floor(usableW / size.widthMm))
  const rows = Math.max(1, Math.floor(usableH / size.heightMm))
  const leftoverX = usableW - columns * size.widthMm
  const leftoverY = usableH - rows * size.heightMm
  const gapXMm = columns > 1 ? leftoverX / (columns - 1) : 0
  const gapYMm = rows > 1 ? leftoverY / (rows - 1) : 0
  return {
    columns,
    rows,
    perPage: columns * rows,
    gapXMm: Math.max(0, Math.min(gapXMm, 2)),
    gapYMm: Math.max(0, Math.min(gapYMm, 2)),
  }
}

export function buildPrintModelId(paper: LabelPaperId, sizeId: LabelSizeId): string {
  return paper === 'a4' ? `a4-${sizeId}` : sizeId
}
