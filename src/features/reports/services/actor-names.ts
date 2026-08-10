/** Mapa id do operador → nome atual (equipe / dono). */
export type ActorNameMap = Record<string, string>

export function buildActorNameMap(
  actors: Array<{ id: string; displayName: string }>,
): ActorNameMap {
  const map: ActorNameMap = {}
  for (const actor of actors) {
    const name = actor.displayName?.trim()
    if (actor.id && name) map[actor.id] = name
  }
  return map
}

/**
 * Prefere o nome atual pelo id; cai no snapshot gravado na venda/caixa.
 * Assim, renomear o membro atualiza relatórios sem reescrever o histórico.
 */
export function resolveActorDisplayName(
  ids: Array<string | undefined | null>,
  snapshotName: string | undefined | null,
  nameById: ActorNameMap | undefined,
  fallback = 'Sem operador',
): string {
  if (nameById) {
    for (const id of ids) {
      if (!id) continue
      const current = nameById[id]?.trim()
      if (current) return current
    }
  }
  const snapshot = snapshotName?.trim()
  if (snapshot) return snapshot
  return fallback
}
