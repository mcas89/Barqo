/**
 * Migrações do banco local.
 * Novas versões do Dexie devem preservar a fila de sync pendente.
 */
export const LOCAL_DB_VERSION = 1

export function describeLocalMigrations(): string[] {
  return [
    'v1: syncQueue + products + customers (cache offline inicial)',
  ]
}
