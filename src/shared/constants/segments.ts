/** Segmentos comerciais — onboarding e configurações (lista única, sem duplicata). */
export const BUSINESS_SEGMENTS = [
  // Alimentação
  'Mercearia / minimercado',
  'Conveniência',
  'Padaria / confeitaria',
  'Lanchonete / food truck',
  'Café / cafeteria',
  'Bar / boteco',
  'Restaurante',
  // Bebidas
  'Adega',
  'Distribuidora de bebidas',
  // Varejo
  'Vestuário / moda',
  'Calçados',
  'Utensílios / casa',
  'Variedades',
  'Presentes / decoração',
  'Pet shop',
  'Papelaria',
  'Cosméticos / perfumaria',
  'Tabacaria',
  // Geral
  'Serviços',
  'Outro',
] as const

export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number]

/**
 * Rótulos antigos / quase-duplicados → segmento atual.
 * Evita o select mostrar “Mercearia / mercado” + “Mercearia / minimercado”.
 */
const SEGMENT_ALIASES: Record<string, BusinessSegment> = {
  'Mercearia / mercado': 'Mercearia / minimercado',
  Vestuário: 'Vestuário / moda',
  Alimentação: 'Restaurante',
  Pub: 'Bar / boteco',
  'Empório de vinhos': 'Adega',
  'Cervejaria / craft': 'Adega',
  Pizzaria: 'Restaurante',
  Hamburgueria: 'Lanchonete / food truck',
  Petiscaria: 'Bar / boteco',
}

export function normalizeBusinessSegment(
  value: string | null | undefined,
): BusinessSegment | string {
  const trimmed = value?.trim()
  if (!trimmed) return BUSINESS_SEGMENTS[0]
  if ((BUSINESS_SEGMENTS as readonly string[]).includes(trimmed)) {
    return trimmed as BusinessSegment
  }
  const aliased = SEGMENT_ALIASES[trimmed]
  if (aliased) return aliased
  return trimmed
}

export function isKnownBusinessSegment(value: string): value is BusinessSegment {
  return (BUSINESS_SEGMENTS as readonly string[]).includes(value)
}
