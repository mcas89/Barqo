import {
  PLAN_FEATURES,
  PLAN_IDS,
  type PlanDefinition,
  type PlanFeature,
  type PlanId,
} from './types'

/**
 * Catálogo comercial — nomes de exibição Solo / Equipe / Gestão.
 * IDs internos (`entrada` / `essencial` / `controle`) permanecem estáveis nas assinaturas.
 */
export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  [PLAN_IDS.ENTRADA]: {
    id: PLAN_IDS.ENTRADA,
    name: 'Solo',
    tagline: 'PDV para quem opera o caixa sozinho',
    audience: 'Para quem vende sozinho no balcão e quer o movimento organizado.',
    priceMonthlyCents: 1990,
    priceSemiannualCents: 9950,
    priceAnnualCents: 19900,
    currency: 'BRL',
    limits: {
      maxUsers: 1,
      maxDevices: 1,
      maxOrganizations: 1,
      maxProducts: 1000,
    },
    features: [
      PLAN_FEATURES.POS,
      PLAN_FEATURES.PRODUCTS,
      PLAN_FEATURES.CASH_REGISTER,
      PLAN_FEATURES.SIMPLE_INVENTORY,
      PLAN_FEATURES.OFFLINE,
      PLAN_FEATURES.PWA,
      PLAN_FEATURES.REPORTS_BASIC,
      PLAN_FEATURES.RECEIVABLES,
    ],
    includedHighlights: [
      '1 usuário (proprietário)',
      '1 dispositivo',
      'Até 1.000 produtos',
      'PDV, produtos, caixa e estoque simples',
      'Fiado na venda (com cliente)',
      'Painel do dia',
      'PWA + vendas e caixa offline',
      'Sem NF-e · cupom interno, não é documento fiscal',
    ],
    growthPain:
      'Quando entram ajudantes no balcão, o Equipe libera mais usuários, aparelhos e relatórios por período.',
  },

  [PLAN_IDS.ESSENCIAL]: {
    id: PLAN_IDS.ESSENCIAL,
    name: 'Equipe',
    tagline: 'Quando entram ajudantes no balcão',
    audience: 'Para vender com colaboradores, acompanhar o fiado e ver o período.',
    priceMonthlyCents: 3990,
    priceSemiannualCents: 19950,
    priceAnnualCents: 39900,
    currency: 'BRL',
    highlighted: true,
    limits: {
      maxUsers: 3,
      maxDevices: 2,
      maxOrganizations: 1,
      maxProducts: 2000,
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
      'Até 2.000 produtos',
      'Multi-usuário e papéis simples',
      'Fiado / contas a receber',
      'Relatórios por período, produtos e operador',
      'PWA + vendas e caixa offline',
      'Sem NF-e · cupom interno, não é documento fiscal',
    ],
    growthPain:
      'Se quiser permissões finas e visão de longe, o Gestão acompanha o próximo passo.',
  },

  [PLAN_IDS.CONTROLE]: {
    id: PLAN_IDS.CONTROLE,
    name: 'Gestão',
    tagline: 'Controle de acessos e números da operação',
    audience: 'Para conduzir a equipe, os acessos e os indicadores com clareza.',
    priceMonthlyCents: 5990,
    priceSemiannualCents: 29950,
    priceAnnualCents: 59900,
    currency: 'BRL',
    limits: {
      maxUsers: 10,
      maxDevices: 5,
      maxOrganizations: 1,
      maxProducts: 5000,
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
      'Até 5.000 produtos',
      'Permissões finas',
      'Relatórios gerenciais + exportação',
      'Suporte prioritário',
      'PWA + vendas e caixa offline',
      'Sem NF-e · cupom interno, não é documento fiscal',
    ],
    growthPain: 'Para lojas que precisam de acessos sob medida e visão gerencial.',
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

/** Amostra grátis do plano Solo / ID entrada (dias) */
export const ENTRADA_TRIAL_DAYS = 10

export const CORE_FEATURES_ALL_PLANS: PlanFeature[] = [
  PLAN_FEATURES.POS,
  PLAN_FEATURES.PRODUCTS,
  PLAN_FEATURES.CASH_REGISTER,
  PLAN_FEATURES.SIMPLE_INVENTORY,
  PLAN_FEATURES.OFFLINE,
  PLAN_FEATURES.PWA,
  PLAN_FEATURES.REPORTS_BASIC,
  PLAN_FEATURES.RECEIVABLES,
]
