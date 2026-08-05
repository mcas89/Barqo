/**
 * Hash de PIN para funcionários (PDV).
 * Não é senha de conta Firebase — só identifica operador no caixa.
 */
export async function hashPin(organizationId: string, pin: string): Promise<string> {
  const normalized = pin.trim()
  const payload = `${organizationId}:${normalized}`
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(
  organizationId: string,
  pin: string,
  pinHash: string,
): Promise<boolean> {
  const next = await hashPin(organizationId, pin)
  return next === pinHash
}

export function validatePinFormat(pin: string): string | null {
  const value = pin.trim()
  if (!/^\d{4,6}$/.test(value)) {
    return 'PIN deve ter 4 a 6 dígitos numéricos.'
  }
  return null
}
