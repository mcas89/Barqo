/** Remove chaves com undefined — Firestore rejeita e responde 400. */
export function omitUndefined<T extends Record<string, unknown>>(data: T): T {
  const clean = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = value
    }
  }
  return clean as T
}
