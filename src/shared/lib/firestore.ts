/** Remove chaves com undefined (inclui objetos aninhados) — Firestore rejeita e responde 400. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

export function omitUndefined<T extends Record<string, unknown>>(data: T): T {
  const clean = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (isPlainObject(value)) {
      clean[key] = omitUndefined(value)
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        isPlainObject(item) ? omitUndefined(item) : item,
      )
    } else {
      clean[key] = value
    }
  }
  return clean as T
}
