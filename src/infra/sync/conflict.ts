/**
 * Regras de conflito serão definidas na implementação do sync.
 * Placeholder para crescimento sem acoplar as features.
 */
export type ConflictStrategy = 'server-wins' | 'client-wins' | 'manual-review'

export interface SyncConflict {
  entity: string
  localId: string
  remoteId?: string
  strategy: ConflictStrategy
  reason: string
}

export function resolveConflictPlaceholder(conflict: SyncConflict): SyncConflict {
  return conflict
}
