import { PRODUCT_TYPES, type Product } from '../types'

const DEFAULT_YIELD_PERCENT = 90

export type BottleStockState = {
  /** Garrafas lacradas / cheias (inteiro). */
  sealed: number
  /** ml na garrafa aberta (0 = nenhuma aberta). */
  openMl: number
  contentMl: number
}

/** Ml efetivos consumidos (já com rendimento / margem de erro). */
export function doseConsumeMl(input: {
  doseMl: number
  yieldPercent?: number
  quantity: number
}): number {
  const doseMl = Math.max(0, Number(input.doseMl) || 0)
  const quantity = Math.max(0, Number(input.quantity) || 0)
  const yieldPct = Math.min(
    100,
    Math.max(1, Number(input.yieldPercent) || DEFAULT_YIELD_PERCENT),
  )
  if (doseMl <= 0 || quantity <= 0) return 0
  return (doseMl * quantity) / (yieldPct / 100)
}

export function bottleContentMl(
  base: Pick<Product, 'unit' | 'contentMl' | 'name'>,
): number {
  if (base.unit === 'ML') {
    const content = Number(base.contentMl) || 0
    // Sem contentMl em ML, cada “unidade de estoque” é 1 ml — modo legado.
    return content > 0 ? content : 1
  }
  if (base.unit === 'L') {
    const content = Number(base.contentMl) || 0
    return content > 0 ? content : 1000
  }
  const content = Number(base.contentMl) || 0
  if (content <= 0) {
    throw new Error(
      `Cadastre o conteúdo em ml da garrafa “${base.name}” (ex.: 750).`,
    )
  }
  return content
}

/** True quando o produto é controlado como garrafas cheias + 1 aberta. */
export function usesBottleStockModel(
  base: Pick<Product, 'unit' | 'contentMl' | 'type'>,
): boolean {
  if (base.type !== PRODUCT_TYPES.PRODUCT) return false
  if (base.unit === 'UN' && Number(base.contentMl) > 0) return true
  if ((base.unit === 'ML' || base.unit === 'L') && Number(base.contentMl) > 0) {
    return true
  }
  return false
}

/**
 * Normaliza estoque legado fracionário (ex.: 2.81 UN) para
 * N cheias + ml na aberta.
 */
export function readBottleStock(
  base: Pick<Product, 'stock' | 'openBottleMlRemaining' | 'unit' | 'contentMl' | 'name' | 'type'>,
): BottleStockState {
  const contentMl = bottleContentMl(base)
  const openStored = Number(base.openBottleMlRemaining)

  if (Number.isFinite(openStored) && openStored > 0) {
    return {
      sealed: Math.max(0, Math.floor(Number(base.stock) || 0)),
      openMl: Math.min(contentMl, Math.round(openStored)),
      contentMl,
    }
  }

  const raw = Math.max(0, Number(base.stock) || 0)
  const sealed = Math.floor(raw + 1e-9)
  const frac = raw - sealed
  if (frac > 1e-6) {
    return {
      sealed,
      openMl: Math.max(0, Math.min(contentMl, Math.round(frac * contentMl))),
      contentMl,
    }
  }
  return { sealed, openMl: 0, contentMl }
}

export function totalAvailableMl(state: BottleStockState): number {
  return state.sealed * state.contentMl + state.openMl
}

/** Quantas doses cabem no ml informado (já considerando rendimento). */
export function dosesFromMl(input: {
  availableMl: number
  doseMl: number
  yieldPercent?: number
}): number {
  const availableMl = Math.max(0, Number(input.availableMl) || 0)
  const perDose = doseConsumeMl({
    doseMl: input.doseMl,
    yieldPercent: input.yieldPercent,
    quantity: 1,
  })
  if (availableMl <= 0 || perDose <= 0) return 0
  return Math.floor(availableMl / perDose + 1e-9)
}

/**
 * Estoque legível no PDV: `2 un / 8 doses`.
 * - un = garrafas cheias
 * - doses = o que ainda sai da garrafa aberta (precisa de doseMl)
 */
export function formatBottleStockLabel(
  base: Pick<Product, 'stock' | 'openBottleMlRemaining' | 'unit' | 'contentMl' | 'name' | 'type'>,
  options?: { doseMl?: number; yieldPercent?: number },
): string {
  if (!usesBottleStockModel(base)) {
    return String(base.stock ?? 0)
  }
  const state = readBottleStock(base)
  const unLabel = `${state.sealed} un`
  const doseMl = Number(options?.doseMl) || 0

  if (doseMl > 0) {
    const openDoses = dosesFromMl({
      availableMl: state.openMl,
      doseMl,
      yieldPercent: options?.yieldPercent,
    })
    if (state.openMl > 0) {
      return `${unLabel} / ${openDoses} doses`
    }
    return unLabel
  }

  if (state.openMl > 0) {
    return `${unLabel} / ${state.openMl} ml`
  }
  return unLabel
}

/** Escolhe o ml de dose de referência ligado à garrafa (menor volume ativo). */
export function resolveLinkedDoseMl(
  products: Array<Pick<Product, 'id' | 'type' | 'active' | 'doseBaseProductId' | 'doseMl' | 'doseYieldPercent'>>,
  baseProductId: string,
): { doseMl: number; yieldPercent?: number } | null {
  let best: { doseMl: number; yieldPercent?: number } | null = null
  for (const item of products) {
    if (item.type !== PRODUCT_TYPES.DOSE) continue
    if (item.active === false) continue
    if (item.doseBaseProductId !== baseProductId) continue
    const doseMl = Number(item.doseMl) || 0
    if (doseMl <= 0) continue
    if (!best || doseMl < best.doseMl) {
      best = {
        doseMl,
        yieldPercent: item.doseYieldPercent,
      }
    }
  }
  return best
}

/**
 * Rótulo de estoque para lista/PDV/estoque.
 * Dose usa a garrafa base; garrafa usa dose ligada → `2 un / 8 doses`.
 */
export function formatProductStockLabel(
  product: Pick<
    Product,
    | 'id'
    | 'type'
    | 'stock'
    | 'unit'
    | 'contentMl'
    | 'openBottleMlRemaining'
    | 'name'
    | 'doseBaseProductId'
    | 'doseMl'
    | 'doseYieldPercent'
  >,
  catalog: Array<
    Pick<
      Product,
      | 'id'
      | 'type'
      | 'active'
      | 'stock'
      | 'unit'
      | 'contentMl'
      | 'openBottleMlRemaining'
      | 'name'
      | 'doseBaseProductId'
      | 'doseMl'
      | 'doseYieldPercent'
    >
  > = [],
): string {
  if (product.type === PRODUCT_TYPES.DOSE && product.doseBaseProductId) {
    const base = catalog.find((item) => item.id === product.doseBaseProductId)
    if (base && usesBottleStockModel(base)) {
      return formatBottleStockLabel(base, {
        doseMl: product.doseMl,
        yieldPercent: product.doseYieldPercent,
      })
    }
    return '—'
  }

  if (product.type !== PRODUCT_TYPES.PRODUCT) return '—'

  if (usesBottleStockModel(product)) {
    const linked = resolveLinkedDoseMl(catalog, product.id)
    return formatBottleStockLabel(
      product,
      linked
        ? { doseMl: linked.doseMl, yieldPercent: linked.yieldPercent }
        : undefined,
    )
  }

  return `${product.stock ?? 0} ${product.unit || 'UN'}`.trim()
}

/** Consome ml: primeiro a aberta; se acabar, abre uma cheia. */
export function applyBottleConsume(
  base: Pick<Product, 'stock' | 'openBottleMlRemaining' | 'unit' | 'contentMl' | 'name' | 'type'>,
  consumeMlRaw: number,
): { stock: number; openBottleMlRemaining: number } {
  const consumeMl = Math.max(0, consumeMlRaw)
  const state = readBottleStock(base)
  if (consumeMl <= 0) {
    return { stock: state.sealed, openBottleMlRemaining: state.openMl }
  }
  if (totalAvailableMl(state) + 1e-6 < consumeMl) {
    throw new Error(
      `Estoque insuficiente em “${base.name}” (disp.: ${formatBottleStockLabel(base)}).`,
    )
  }

  let { sealed, openMl, contentMl } = state
  let left = consumeMl

  while (left > 1e-6) {
    if (openMl <= 1e-6) {
      if (sealed < 1) {
        throw new Error(`Estoque insuficiente em “${base.name}”.`)
      }
      sealed -= 1
      openMl = contentMl
    }
    const take = Math.min(openMl, left)
    openMl -= take
    left -= take
    if (openMl < 0.5) openMl = 0
  }

  return {
    stock: sealed,
    openBottleMlRemaining: Math.round(openMl),
  }
}

/** Devolve ml (cancelamento): enche a aberta; o que sobrar vira garrafa cheia. */
export function applyBottleRestore(
  base: Pick<Product, 'stock' | 'openBottleMlRemaining' | 'unit' | 'contentMl' | 'name' | 'type'>,
  restoreMlRaw: number,
): { stock: number; openBottleMlRemaining: number } {
  const restoreMl = Math.max(0, restoreMlRaw)
  const state = readBottleStock(base)
  if (restoreMl <= 0) {
    return { stock: state.sealed, openBottleMlRemaining: state.openMl }
  }

  let sealed = state.sealed
  let openMl = state.openMl
  const contentMl = state.contentMl
  let left = restoreMl

  while (left > 1e-6) {
    if (openMl <= 1e-6) {
      // começa uma aberta vazia para receber
      openMl = 0
    }
    const room = contentMl - openMl
    if (room <= 1e-6) {
      sealed += 1
      openMl = 0
      continue
    }
    const add = Math.min(room, left)
    openMl += add
    left -= add
    if (openMl >= contentMl - 0.5) {
      sealed += 1
      openMl = 0
    }
  }

  return {
    stock: sealed,
    openBottleMlRemaining: Math.round(openMl),
  }
}

/**
 * Converte o consumo em ml para a unidade de estoque da garrafa base.
 * Mantido para custo / modos legados sem contentMl em ML.
 */
export function doseConsumeStockUnits(input: {
  doseMl: number
  yieldPercent?: number
  quantity: number
  base: Pick<Product, 'unit' | 'contentMl' | 'name'>
}): number {
  const consumeMl = doseConsumeMl(input)
  if (consumeMl <= 0) return 0

  const unit = input.base.unit
  if (unit === 'ML' && !(Number(input.base.contentMl) > 0)) return consumeMl
  if (unit === 'L' && !(Number(input.base.contentMl) > 0)) return consumeMl / 1000

  const content = bottleContentMl(input.base)
  return consumeMl / content
}

export function assertDoseProductReady(dose: Product, base: Product | null): void {
  if (dose.type !== PRODUCT_TYPES.DOSE) return
  if (!dose.doseBaseProductId) {
    throw new Error(`A dose “${dose.name}” precisa de uma garrafa base.`)
  }
  if (!dose.doseMl || dose.doseMl <= 0) {
    throw new Error(`Informe o volume (ml) da dose “${dose.name}”.`)
  }
  if (!base || !base.active) {
    throw new Error(`Garrafa base da dose “${dose.name}” não encontrada ou inativa.`)
  }
  if (base.type !== PRODUCT_TYPES.PRODUCT) {
    throw new Error(`A base da dose deve ser um produto (garrafa), não “${base.type}”.`)
  }
  bottleContentMl(base)
}

/**
 * Custo da dose a partir do custo da garrafa (proporcional ao ml consumido).
 */
export function doseCostCentsFromBase(input: {
  doseMl: number
  yieldPercent?: number
  base: Pick<Product, 'unit' | 'contentMl' | 'costCents' | 'name' | 'type'>
}): number {
  const bottleCost = Math.max(0, Math.round(input.base.costCents || 0))
  if (bottleCost <= 0) return 0
  try {
    const consumeMl = doseConsumeMl({
      doseMl: input.doseMl,
      yieldPercent: input.yieldPercent,
      quantity: 1,
    })
    const content = bottleContentMl(input.base)
    if (consumeMl <= 0 || content <= 0) return 0
    return Math.round(bottleCost * (consumeMl / content))
  } catch {
    return 0
  }
}

export { DEFAULT_YIELD_PERCENT }
