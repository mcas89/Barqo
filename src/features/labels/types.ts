export const LABEL_MODELS = {
  '40x25': {
    id: '40x25',
    label: '40 × 25 mm',
    widthMm: 40,
    heightMm: 25,
  },
  '50x30': {
    id: '50x30',
    label: '50 × 30 mm',
    widthMm: 50,
    heightMm: 30,
  },
  '60x40': {
    id: '60x40',
    label: '60 × 40 mm',
    widthMm: 60,
    heightMm: 40,
  },
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
