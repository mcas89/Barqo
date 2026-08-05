import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../pos/types'
import type { BuildReceiptInput, SaleReceiptPayload } from './types'

export function buildSaleReceipt(input: BuildReceiptInput): SaleReceiptPayload {
  const { sale, organization, settings } = input
  const payload: SaleReceiptPayload = {
    schemaVersion: 1,
    saleId: sale.id,
    organizationId: sale.organizationId,
    organizationName: organization.name,
    soldByName: sale.soldByName,
    items: sale.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })),
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    totalCents: sale.totalCents,
    payments: sale.payments.map((payment) => ({
      method: payment.method,
      label: PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method,
      amountCents: payment.amountCents,
    })),
    changeCents: sale.changeCents,
    createdAt: sale.createdAt,
    paperWidth: settings.paperWidth,
  }

  if (organization.document) payload.organizationDocument = organization.document
  if (organization.phone) payload.organizationPhone = organization.phone
  if (organization.address) payload.organizationAddress = organization.address
  if (organization.whatsapp) payload.organizationWhatsapp = organization.whatsapp
  if (organization.logoDataUrl) payload.logoDataUrl = organization.logoDataUrl
  if (sale.customerName) payload.customerName = sale.customerName
  if (sale.customerId) payload.customerId = sale.customerId
  if (input.customerEmail) payload.customerEmail = input.customerEmail
  if (input.customerPhone) payload.customerPhone = input.customerPhone
  if (settings.printerPath) payload.printerPath = settings.printerPath
  if (sale.note) payload.note = sale.note

  return payload
}
