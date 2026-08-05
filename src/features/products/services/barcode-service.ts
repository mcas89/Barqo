import {
  BARCODE_SOURCES,
  BARCODE_TYPES,
  type BarcodeSource,
  type BarcodeType,
  type Product,
  type ProductBarcodeMeta,
} from '../types'

const INTERNAL_PREFIX = 'BQL'

/** Gera Code 128 interno permanente — não depende de contador online. */
export function generateBalqoInternalBarcode(): string {
  const bytes = new Uint8Array(5)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let n = 0
  for (const b of bytes) n = (n * 256 + b) % 10_000_000_000
  return `${INTERNAL_PREFIX}${String(n).padStart(10, '0')}`
}

export function isBalqoInternalBarcode(value: string): boolean {
  return /^BQL\d{10}$/i.test(value.trim())
}

export function inferBarcodeType(value: string): BarcodeType {
  const code = value.trim()
  if (!code) return BARCODE_TYPES.OTHER
  if (isBalqoInternalBarcode(code)) return BARCODE_TYPES.CODE128_INTERNAL
  if (/^\d{13}$/.test(code)) return BARCODE_TYPES.EAN13
  if (/^\d{8}$/.test(code)) return BARCODE_TYPES.EAN8
  return BARCODE_TYPES.OTHER
}

export function inferBarcodeSource(value: string, preferred?: BarcodeSource): BarcodeSource {
  if (preferred) return preferred
  if (isBalqoInternalBarcode(value)) return BARCODE_SOURCES.BALQO_GENERATED
  const type = inferBarcodeType(value)
  if (type === BARCODE_TYPES.EAN13 || type === BARCODE_TYPES.EAN8) {
    return BARCODE_SOURCES.MANUFACTURER
  }
  return BARCODE_SOURCES.MANUAL
}

export function buildBarcodeMeta(input: {
  value: string
  type?: BarcodeType
  source?: BarcodeSource
  generatedAt?: string
  generatedByOperatorId?: string
}): ProductBarcodeMeta {
  const value = input.value.trim()
  return {
    value,
    type: input.type ?? inferBarcodeType(value),
    source: input.source ?? inferBarcodeSource(value),
    generatedAt: input.generatedAt,
    generatedByOperatorId: input.generatedByOperatorId,
  }
}

export function normalizeBarcodeKey(value: string): string {
  return value.trim().toLowerCase()
}

export function findBarcodeConflict(
  products: Product[],
  barcode: string,
  excludeProductId?: string,
): Product | null {
  const key = normalizeBarcodeKey(barcode)
  if (!key) return null
  return (
    products.find(
      (product) =>
        product.id !== excludeProductId &&
        Boolean(product.barcode) &&
        normalizeBarcodeKey(product.barcode!) === key,
    ) ?? null
  )
}

export function productHasBarcode(product: Product): boolean {
  return Boolean(product.barcode?.trim())
}
