import { PLAN_IDS, type PlanId } from '../../../shared/constants/plans'

export { PLAN_IDS, type PlanId }

export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  GRACE: 'grace',
  BLOCKED: 'blocked',
  CANCELED: 'canceled',
} as const

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]

export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  SEMIANNUAL: 'semiannual',
  ANNUAL: 'annual',
} as const

export type BillingCycle = (typeof BILLING_CYCLES)[keyof typeof BILLING_CYCLES]

export const BILLING_CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
}

/** Recursos que o plano libera ou bloqueia */
export const PLAN_FEATURES = {
  POS: 'pos',
  PRODUCTS: 'products',
  CASH_REGISTER: 'cash_register',
  SIMPLE_INVENTORY: 'simple_inventory',
  OFFLINE: 'offline',
  PWA: 'pwa',
  MULTI_USER: 'multi_user',
  RECEIVABLES: 'receivables',
  REPORTS_BASIC: 'reports_basic',
  REPORTS_PERIOD: 'reports_period',
  REPORTS_MANAGERIAL: 'reports_managerial',
  SIMPLE_ROLES: 'simple_roles',
  FINE_PERMISSIONS: 'fine_permissions',
  EXPORT_REPORTS: 'export_reports',
  PRIORITY_SUPPORT: 'priority_support',
} as const

export type PlanFeature = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES]

export interface PlanLimits {
  maxUsers: number
  maxDevices: number
  maxOrganizations: number
  /** Produtos ativos (cadastro). */
  maxProducts: number
}

export interface PlanDefinition {
  id: PlanId
  name: string
  tagline: string
  audience: string
  priceMonthlyCents: number
  priceSemiannualCents: number
  priceAnnualCents: number
  currency: 'BRL'
  highlighted?: boolean
  limits: PlanLimits
  features: PlanFeature[]
  includedHighlights: string[]
  growthPain: string
}

export interface OrganizationSubscription {
  organizationId: string
  planId: PlanId
  status: SubscriptionStatus
  /** Fim do trial gratuito (Solo: 10 dias) */
  trialEndsAt?: string
  /** Cobrança manual no início — pago até esta data */
  paidThrough?: string
  graceUntil?: string
  billingCycle?: BillingCycle
  updatedAt: string
  lastPayment?: {
    orderNsu: string
    transactionNsu?: string
    slug?: string
    captureMethod?: string
    amountCents: number
    paidAt: string
    receiptUrl?: string
    billingCycle?: BillingCycle
    gatewayId?: string
  }
}
