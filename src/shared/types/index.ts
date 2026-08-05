import type { UserRole, PlanId } from '../constants'

export type OrganizationId = string
export type UserId = string

export interface Organization {
  id: OrganizationId
  name: string
  document?: string
  segment?: string
  phone?: string
  address?: string
  /** Plano comercial ativo da organização */
  planId?: PlanId
  /** Cor da marca no app (hex). */
  themeColor?: string
  /** Logo em data URL (PNG/JPEG pequeno) ou vazio = marca BALQO. */
  logoDataUrl?: string
  /** WhatsApp da loja (somente números, com DDI). */
  whatsapp?: string
  /** Imprime cupom ao finalizar a venda no PDV. */
  printReceiptOnSale?: boolean
  /** Enfileira/envia comprovante (e-mail) ao finalizar a venda. */
  sendReceiptOnSale?: boolean
  /** Caminho ou nome padrão da impressora (fallback do aparelho). */
  printerPath?: string
  /** Largura do cupom térmico. */
  receiptPaperWidth?: '58mm' | '80mm'
  ownerId?: string
  ownerEmail?: string
  ownerName?: string
  createdAt: string
  updatedAt?: string
}

export interface AppUser {
  id: UserId
  email: string
  displayName: string
  organizationIds: OrganizationId[]
  role: UserRole
}

export interface MoneyCents {
  /** Valores monetários em centavos para evitar float */
  cents: number
}
