import {
  PLAN_FEATURES,
  PLAN_IDS,
  type PlanDefinition,
  type PlanFeature,
  type PlanId,
} from './types'

/**
 * Catálogo comercial fechado da V0.1.
 * Fonte única para UI, gates e painel admin.
 */
export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  [PLAN_IDS.ENTRADA]: {
    id: PLAN_IDS.ENTRADA,
    name: 'Entrada',
    tagline: 'Sai do papel e da calculadora',
    audience: 'Proprietário operando sozinho o básico do balcão.',
    priceMonthlyCents: 1990,
    priceSemiannualCents: 9950,
    priceAnnualCents: 19900,
    currency: 'BRL',
    limits: {
      maxUsers: 1,
      maxDevices: 1,
      maxOrganizations: 1,
    },
    features: [
      PLAN_FEATURES.POS,
      PLAN_FEATURES.PRODUCTS,
      PLAN_FEATURES.CASH_REGISTER,
      PLAN_FEATURES.SIMPLE_INVENTORY,
      PLAN_FEATURES.OFFLINE,
      PLAN_FEATURES.PWA,
      PLAN_FEATURES.REPORTS_BASIC,
    ],
    includedHighlights: [
      '1 usuário (proprietário)',
      '1 dispositivo',
      'PDV, produtos, caixa e estoque simples',
      'Painel do dia',
      'PWA + operação offline',
    ],
    growthPain:
      'As limitações aparecem quando surge funcionário, fiado ou necessidade de mais controle.',
  },

  [PLAN_IDS.ESSENCIAL]: {
    id: PLAN_IDS.ESSENCIAL,
    name: 'Essencial',
    tagline: 'O plano da loja pequena',
    audience: 'Comércio com 1 ou 2 funcionários no dia a dia.',
    priceMonthlyCents: 3990,
    priceSemiannualCents: 19950,
    priceAnnualCents: 39900,
    currency: 'BRL',
    highlighted: true,
    limits: {
      maxUsers: 3,
      maxDevices: 2,
      maxOrganizations: 1,
    },
    features: [
      PLAN_FEATURES.POS,
      PLAN_FEATURES.PRODUCTS,
      PLAN_FEATURES.CASH_REGISTER,
      PLAN_FEATURES.SIMPLE_INVENTORY,
      PLAN_FEATURES.OFFLINE,
      PLAN_FEATURES.PWA,
      PLAN_FEATURES.MULTI_USER,
      PLAN_FEATURES.RECEIVABLES,
      PLAN_FEATURES.REPORTS_BASIC,
      PLAN_FEATURES.REPORTS_PERIOD,
      PLAN_FEATURES.SIMPLE_ROLES,
    ],
    includedHighlights: [
      'Até 3 usuários',
      'Até 2 dispositivos',
      'Multi-usuário e papéis simples',
      'Fiado / contas a receber',
      'Relatórios por período, produtos e operador',
      'PWA + operação offline',
    ],
    growthPain:
      'Upgrade natural quando precisa de várias pessoas, permissões finas ou relatórios gerenciais.',
  },

  [PLAN_IDS.CONTROLE]: {
    id: PLAN_IDS.CONTROLE,
    name: 'Controle',
    tagline: 'Mais gente, mais controle, mais visão',
    audience: 'Quem precisa de permissões finas e visão gerencial.',
    priceMonthlyCents: 5990,
    priceSemiannualCents: 29950,
    priceAnnualCents: 59900,
    currency: 'BRL',
    limits: {
      maxUsers: 10,
      maxDevices: 5,
      maxOrganizations: 1,
    },
    features: [
      PLAN_FEATURES.POS,
      PLAN_FEATURES.PRODUCTS,
      PLAN_FEATURES.CASH_REGISTER,
      PLAN_FEATURES.SIMPLE_INVENTORY,
      PLAN_FEATURES.OFFLINE,
      PLAN_FEATURES.PWA,
      PLAN_FEATURES.MULTI_USER,
      PLAN_FEATURES.RECEIVABLES,
      PLAN_FEATURES.REPORTS_BASIC,
      PLAN_FEATURES.REPORTS_PERIOD,
      PLAN_FEATURES.REPORTS_MANAGERIAL,
      PLAN_FEATURES.SIMPLE_ROLES,
      PLAN_FEATURES.FINE_PERMISSIONS,
      PLAN_FEATURES.EXPORT_REPORTS,
      PLAN_FEATURES.PRIORITY_SUPPORT,
    ],
    includedHighlights: [
      'Até 10 usuários',
      'Até 5 dispositivos',
      'Permissões finas',
      'Relatórios gerenciais + exportação',
      'Suporte prioritário',
      'PWA + operação offline',
    ],
    growthPain: 'Plano de margem — controle operacional completo para quem já cresceu.',
  },
}

export const PLAN_LIST: PlanDefinition[] = [
  PLAN_CATALOG[PLAN_IDS.ENTRADA],
  PLAN_CATALOG[PLAN_IDS.ESSENCIAL],
  PLAN_CATALOG[PLAN_IDS.CONTROLE],
]

export const DEFAULT_PLAN_ID: PlanId = PLAN_IDS.ENTRADA

/** Plano comercial-alvo (volume no médio prazo) */
export const TARGET_PLAN_ID: PlanId = PLAN_IDS.ESSENCIAL

/** Amostra grátis do plano Entrada (dias) */
export const ENTRADA_TRIAL_DAYS = 10

/** Dias de uso após o vencimento antes de bloquear */
export const PAYMENT_GRACE_DAYS = 3

/** Aviso amarelo no Início quando faltam estes dias */
export const PAYMENT_WARNING_DAYS = 3

export const CORE_FEATURES_ALL_PLANS: PlanFeature[] = [
  PLAN_FEATURES.POS,
  PLAN_FEATURES.PRODUCTS,
  PLAN_FEATURES.CASH_REGISTER,
  PLAN_FEATURES.SIMPLE_INVENTORY,
  PLAN_FEATURES.OFFLINE,
  PLAN_FEATURES.PWA,
  PLAN_FEATURES.REPORTS_BASIC,
]
