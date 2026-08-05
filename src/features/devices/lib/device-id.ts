import { createId } from '../../../shared/lib/ids'
import { localDb } from '../../../infra/offline/db'

const STORAGE_KEY = 'balqo.device.id'
const META_KEY = 'deviceId'

export function getLocalDeviceIdSync(): string {
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

/** Compat síncrona — preferir resolveLocalDeviceId no boot. */
export function getLocalDeviceId(): string {
  return getLocalDeviceIdSync()
}

/** Garante deviceId permanente: IndexedDB + espelho localStorage. */
export async function resolveLocalDeviceId(): Promise<string> {
  try {
    const row = await localDb.deviceMeta.get(META_KEY)
    if (row?.value) {
      try {
        localStorage.setItem(STORAGE_KEY, row.value)
      } catch {
        // ignore
      }
      return row.value
    }
  } catch {
    // Dexie indisponível — cai no localStorage
  }

  const fromStorage = getLocalDeviceIdSync()
  try {
    await localDb.deviceMeta.put({ key: META_KEY, value: fromStorage })
  } catch {
    // ignore
  }
  return fromStorage
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

export function parseDevicePlatform(): { platform: string; browser: string } {
  const label = describeThisDevice()
  const [browser, platform] = label.split(' · ')
  return { browser: browser || 'Navegador', platform: platform || 'Outro' }
}
