import { getLocalDeviceId } from '../devices'
import type { Organization } from '../../shared/types'
import type { ReceiptPaperWidth, ReceiptSettings } from './types'

const PRINTER_PATH_KEY = (deviceId: string) => `balqo.printerPath.${deviceId}`

export function normalizePaperWidth(value: unknown): ReceiptPaperWidth {
  return value === '80mm' ? '80mm' : '58mm'
}

export function readLocalPrinterPath(deviceId = getLocalDeviceId()): string {
  try {
    return localStorage.getItem(PRINTER_PATH_KEY(deviceId))?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeLocalPrinterPath(path: string, deviceId = getLocalDeviceId()) {
  try {
    const trimmed = path.trim()
    if (trimmed) localStorage.setItem(PRINTER_PATH_KEY(deviceId), trimmed)
    else localStorage.removeItem(PRINTER_PATH_KEY(deviceId))
  } catch {
    // storage indisponível
  }
}

export function resolveReceiptSettings(input: {
  organization?: Organization | null
  devicePrinterPath?: string | null
}): ReceiptSettings {
  const organization = input.organization
  const printerPath =
    input.devicePrinterPath?.trim() ||
    readLocalPrinterPath() ||
    organization?.printerPath?.trim() ||
    ''

  return {
    printOnSale: Boolean(organization?.printReceiptOnSale),
    // Envio automático por e-mail ainda não entra na oferta — força off.
    sendReceiptOnSale: false,
    printerPath,
    paperWidth: normalizePaperWidth(organization?.receiptPaperWidth),
  }
}
