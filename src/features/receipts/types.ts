import type { Organization } from '../../shared/types'
import type { Sale } from '../pos/types'

export type ReceiptPaperWidth = '58mm' | '80mm'

export type ReceiptChannel = 'print' | 'email'

export type ReceiptDeliveryStatus = 'sent' | 'queued' | 'skipped' | 'failed'

export interface ReceiptSettings {
  printOnSale: boolean
  sendReceiptOnSale: boolean
  offerWhatsappReceiptOnSale: boolean
  printerPath: string
  paperWidth: ReceiptPaperWidth
}

export interface SaleReceiptItem {
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export interface SaleReceiptPayment {
  method: string
  label: string
  amountCents: number
}

/** Payload estável para impressão local e futura API de comprovante. */
export interface SaleReceiptPayload {
  schemaVersion: 1
  saleId: string
  organizationId: string
  organizationName: string
  organizationDocument?: string
  organizationPhone?: string
  organizationAddress?: string
  organizationWhatsapp?: string
  logoDataUrl?: string
  soldByName: string
  customerName?: string
  customerId?: string
  customerEmail?: string
  customerPhone?: string
  items: SaleReceiptItem[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  payments: SaleReceiptPayment[]
  changeCents: number
  createdAt: string
  paperWidth: ReceiptPaperWidth
  printerPath?: string
  note?: string
  copy?: 'original' | 'segunda_via'
}

export interface ReceiptDeliveryResult {
  channel: ReceiptChannel
  status: ReceiptDeliveryStatus
  message?: string
}

export interface ReceiptOutboxItem {
  id: string
  createdAt: string
  attempts: number
  payload: SaleReceiptPayload
}

export interface BuildReceiptInput {
  sale: Sale
  organization: Organization
  settings: ReceiptSettings
  customerEmail?: string
  customerPhone?: string
  copy?: 'original' | 'segunda_via'
}
