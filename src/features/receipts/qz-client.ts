import qz from 'qz-tray'
import { KEYUTIL, Signature, hextob64 } from 'jsrsasign'
import privateKeyPem from './qz-private-key.pem?raw'

export const QZ_DOWNLOAD_URL = 'https://qz.io/download/'
export const QZ_OVERRIDE_URL = '/qz/override.crt'
export const QZ_CERT_URL = '/qz/digital-certificate.txt'
export const QZ_INSTALL_GUIDE_URL = '/qz/COMO-INSTALAR.txt'

export interface SystemPrinter {
  name: string
  isDefault?: boolean
  port?: string
}

export const BROWSER_PRINT_VALUE = '__browser__'

let securityConfigured = false

function normalizePem(pem: string): string {
  return pem.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim() + '\n'
}

function signPayload(toSign: string): string {
  const pk = KEYUTIL.getKey(normalizePem(privateKeyPem))
  const sig = new Signature({ alg: 'SHA512withRSA' })
  sig.init(pk)
  sig.updateString(toSign)
  return hextob64(sig.sign())
}

function ensureSecurity() {
  if (securityConfigured) return
  securityConfigured = true

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch(QZ_CERT_URL, {
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Certificado QZ HTTP ${response.status}`)
        return response.text()
      })
      .then((text) => resolve(normalizePem(text)))
      .catch(reject)
  })

  qz.security.setSignatureAlgorithm('SHA512')
  // Classic factory: returns (resolve, reject) => void — works even if the bundler
  // rewrites async functions (QZ only treats native AsyncFunction specially).
  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve, reject) => {
      try {
        resolve(signPayload(toSign))
      } catch (err) {
        console.error('QZ signature failed', err)
        reject(err instanceof Error ? err.message : String(err))
      }
    }
  })
}

export async function connectQz(): Promise<void> {
  ensureSecurity()
  if (qz.websocket.isActive()) return
  await qz.websocket.connect()
}

export async function disconnectQz(): Promise<void> {
  if (!qz.websocket.isActive()) return
  await qz.websocket.disconnect()
}

export async function pingQz(): Promise<boolean> {
  try {
    await connectQz()
    return qz.websocket.isActive()
  } catch {
    return false
  }
}

export async function listSystemPrinters(): Promise<{
  printers: SystemPrinter[]
  agentOnline: boolean
  agentUrl: string
}> {
  try {
    await connectQz()
    const names = (await qz.printers.find()) as string[]
    const printers = (names ?? [])
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => ({ name: name.trim() }))
    return { printers, agentOnline: true, agentUrl: 'qz-tray' }
  } catch {
    return { printers: [], agentOnline: false, agentUrl: 'qz-tray' }
  }
}

export async function printRawText(printerName: string, text: string): Promise<void> {
  const name = printerName.trim()
  if (!name || name === BROWSER_PRINT_VALUE) {
    throw new Error('Selecione uma impressora do QZ Tray.')
  }
  await connectQz()
  const config = qz.configs.create(name)
  await qz.print(config, [text])
}

/** Compatível com o nome antigo do agente. */
export async function pingPrintAgent(): Promise<boolean> {
  return pingQz()
}

export function resolvePrintAgentUrl(): string {
  return 'qz-tray'
}

export const DEFAULT_PRINT_AGENT_URL = 'qz-tray'
