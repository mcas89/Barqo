/**
 * Migrações do banco local.
 * Novas versões do Dexie devem preservar a fila de sync pendente.
 */
export const LOCAL_DB_VERSION = 3

export function describeLocalMigrations(): string[] {
  return [
    'v1: syncQueue + products + customers (cache offline inicial)',
    'v2: localSales + cashSessions + cache completo de produtos',
    'v3: deviceMeta + deviceLeases + subscriptionLeases (Passo 3)',
  ]
}
