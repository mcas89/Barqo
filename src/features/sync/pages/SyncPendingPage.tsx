import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  listPendingOperations,
  resetQueueItem,
  type SyncQueueItem,
} from '../../../infra/offline'
import { requestSyncPass, runSyncPass } from '../../../infra/sync'
import { formatMoney } from '../../../shared/lib/money'
import type { SaleCreateQueuePayload } from '../../../infra/offline'
import './SyncPendingPage.css'

const OP_LABELS: Record<string, string> = {
  'sale.create': 'Venda',
  'cash.open': 'Abertura de caixa',
  'cash.close': 'Fechamento de caixa',
  'cash.movement': 'Movimento de caixa',
  'sale.cancel': 'Cancelamento',
  'stock.adjust': 'Estoque',
  'product.upsert': 'Produto',
  'customer.upsert': 'Cliente',
}

function describeItem(item: SyncQueueItem): string {
  if (item.operation === 'sale.create') {
    const payload = item.payload as SaleCreateQueuePayload
    const total = payload?.sale?.totalCents
    const who = payload?.sale?.soldByName
    const parts = [
      payload?.sale?.id ? `Venda ${payload.sale.id}` : 'Venda',
      total != null ? formatMoney(total) : null,
      who || null,
    ].filter(Boolean)
    return parts.join(' · ')
  }
  if (item.operation === 'cash.open' || item.operation === 'cash.close') {
    const session = (item.payload as { session?: { id?: string; openedByName?: string; closedByName?: string } })
      ?.session
    const who =
      item.operation === 'cash.close'
        ? session?.closedByName
        : session?.openedByName
    return `Caixa ${session?.id ?? ''} · ${who ?? ''}`.trim()
  }
  return OP_LABELS[item.operation] ?? item.operation
}

export function SyncPendingPage() {
  const { organization } = useAuth()
  const organizationId = organization?.id
  const [items, setItems] = useState<SyncQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await listPendingOperations(organizationId))
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar a fila local.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function syncNow() {
    if (!organizationId) return
    setBusy(true)
    setError(null)
    try {
      const result = await runSyncPass(organizationId)
      setLastSynced(result.synced)
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar.')
    } finally {
      setBusy(false)
    }
  }

  async function retryItem(id: string) {
    setBusy(true)
    setError(null)
    try {
      await resetQueueItem(id)
      requestSyncPass(organizationId)
      await runSyncPass(organizationId)
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao tentar de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sync-pending">
      <header className="sync-pending__header">
        <div>
          <h1>Sincronização</h1>
          <p>Operações feitas offline aguardando envio ao servidor.</p>
        </div>
        <button
          type="button"
          className="sync-pending__cta"
          disabled={busy || !organizationId}
          onClick={() => void syncNow()}
        >
          {busy ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
      </header>

      {error ? (
        <p className="sync-pending__error" role="alert">
          {error}
        </p>
      ) : null}

      {lastSynced != null && lastSynced > 0 ? (
        <p className="sync-pending__ok" role="status">
          {lastSynced} operação(ões) sincronizada(s).
        </p>
      ) : null}

      {loading ? (
        <p className="sync-pending__empty">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="sync-pending__empty">Nenhuma operação pendente. Tudo sincronizado.</p>
      ) : (
        <ul className="sync-pending__list">
          {items.map((item) => (
            <li
              key={item.id}
              className={
                item.lastError
                  ? 'sync-pending__item sync-pending__item--error'
                  : 'sync-pending__item'
              }
            >
              <div className="sync-pending__main">
                <strong>{OP_LABELS[item.operation] ?? item.operation}</strong>
                <span>{describeItem(item)}</span>
                <span className="sync-pending__meta">
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                  {item.attempts > 0 ? ` · ${item.attempts} tentativa(s)` : ''}
                </span>
                {item.lastError ? (
                  <span className="sync-pending__err-msg">{item.lastError}</span>
                ) : null}
              </div>
              {item.lastError ? (
                <button
                  type="button"
                  className="sync-pending__retry"
                  disabled={busy}
                  onClick={() => void retryItem(item.id)}
                >
                  Tentar de novo
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
