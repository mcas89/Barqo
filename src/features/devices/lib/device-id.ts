import { createId } from '../../../shared/lib/ids'

const STORAGE_KEY = 'balqo.device.id'

export function getLocalDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id = createId('dev')
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return createId('dev')
  }
}

export function describeThisDevice(): string {
  const ua = globalThis.navigator?.userAgent ?? ''
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Navegador'
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Mac OS')
      ? 'Mac'
      : ua.includes('Android')
        ? 'Android'
        : ua.includes('iPhone') || ua.includes('iPad')
          ? 'iOS'
          : 'Outro'
  return `${browser} · ${os}`
}
