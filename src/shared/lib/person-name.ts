const GENERIC_NAMES = new Set([
  'usuário',
  'usuario',
  'user',
  'dono',
  'proprietário',
  'proprietario',
])

function looksLikeEmailFragment(name: string): boolean {
  if (name.includes('@')) return true
  if (/\s/.test(name)) return false
  return /[.+_]/.test(name) || /\d/.test(name)
}

/** Nome de pessoa para UI — nunca usa e-mail nem prefixo de e-mail. */
export function resolvePersonName(
  displayName: string | null | undefined,
  fallback = 'Proprietário',
): string {
  const name = displayName?.trim() ?? ''
  if (!name || GENERIC_NAMES.has(name.toLowerCase()) || looksLikeEmailFragment(name)) {
    return fallback
  }
  return name
}

export function pickPersonName(
  candidates: Array<string | null | undefined>,
  fallback = 'Proprietário',
): string {
  for (const candidate of candidates) {
    const name = resolvePersonName(candidate, '')
    if (name) return name
  }
  return fallback
}
