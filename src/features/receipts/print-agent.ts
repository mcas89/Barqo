export const DEFAULT_PRINT_AGENT_URL = 'http://127.0.0.1:17890'
export const BROWSER_PRINT_VALUE = '__browser__'

export interface SystemPrinter {
  name: string
  isDefault?: boolean
  port?: string
}

export function resolvePrintAgentUrl(): string {
  const configured = import.meta.env.VITE_PRINT_AGENT_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return DEFAULT_PRINT_AGENT_URL
}

export async function listSystemPrinters(): Promise<{
  printers: SystemPrinter[]
  agentOnline: boolean
  agentUrl: string
}> {
  const agentUrl = resolvePrintAgentUrl()
  try {
    const response = await fetch(`${agentUrl}/printers`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { printers?: SystemPrinter[] }
    const printers = (data.printers ?? [])
      .filter((printer) => printer?.name?.trim())
      .map((printer) => ({
        name: printer.name.trim(),
        isDefault: Boolean(printer.isDefault),
        port: printer.port,
      }))
    return { printers, agentOnline: true, agentUrl }
  } catch {
    return { printers: [], agentOnline: false, agentUrl }
  }
}

export async function pingPrintAgent(): Promise<boolean> {
  const listed = await listSystemPrinters()
  return listed.agentOnline
}
