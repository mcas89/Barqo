/** Produtos vendidos por peso/volume digitado no PDV (a granel). */
export function productSoldByWeight(unit: string | undefined): boolean {
  const u = (unit ?? '').toUpperCase()
  return u === 'KG' || u === 'G' || u === 'L' || u === 'ML'
}

export function formatCartQuantity(quantity: number, unit?: string): string {
  const qty = quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
  if (!unit) return qty
  const u = unit.toUpperCase()
  if (u === 'KG' || u === 'G' || u === 'L' || u === 'ML') {
    return `${qty} ${u.toLowerCase()}`
  }
  return qty
}
