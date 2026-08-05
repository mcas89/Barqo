/**
 * Analytics stub — conectar depois (Firebase Analytics / outro).
 */
export function trackEvent(name: string, payload?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, payload ?? {})
  }
}
