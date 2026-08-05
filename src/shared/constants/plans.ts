export const PLAN_IDS = {
  ENTRADA: 'entrada',
  ESSENCIAL: 'essencial',
  CONTROLE: 'controle',
} as const

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS]
