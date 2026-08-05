import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  addCashMovement,
  buildCashSummary,
  closeCashSession,
  getOpenCashSession,
  listRecentCashSessions,
  listSalesByCashSession,
  listSalesSince,
  openCashSession,
} from '../services/cash-service'
import {
  CASH_MOVEMENT_TYPES,
  type CashMovementType,
  type CashSession,
  type CashSummary,
} from '../types'

export function useCashRegister() {
  const { organization, user } = useAuth()
  const [session, setSession] = useState<CashSession | null>(null)
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [recent, setRecent] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setSession(null)
      setSummary(null)
      setRecent([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [open, recentSessions] = await Promise.all([
        getOpenCashSession(organizationId),
        listRecentCashSessions(organizationId),
      ])

      setSession(open)
      setRecent(recentSessions)

      if (open) {
        const [bySession, sinceOpen] = await Promise.all([
          listSalesByCashSession(organizationId, open.id),
          listSalesSince(organizationId, open.openedAt),
        ])
        const merged = new Map<string, (typeof bySession)[number]>()
        for (const sale of [...sinceOpen, ...bySession]) {
          merged.set(sale.id, sale)
        }
        setSummary(buildCashSummary(open, Array.from(merged.values())))
      } else {
        setSummary(null)
      }
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o caixa.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function open(openingAmountCents: number) {
    if (!organizationId || !user) throw new Error('Sessão inválida.')
    setBusy(true)
    setError(null)
    try {
      await openCashSession({
        organizationId,
        openingAmountCents,
        userId: user.id,
        userName: user.displayName || user.email,
      })
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao abrir o caixa.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function move(type: CashMovementType, amountCents: number, reason?: string) {
    if (!organizationId || !user || !session) throw new Error('Caixa fechado.')
    setBusy(true)
    setError(null)
    try {
      await addCashMovement({
        organizationId,
        sessionId: session.id,
        type,
        amountCents,
        reason,
        userId: user.id,
        userName: user.displayName || user.email,
      })
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao registrar movimento.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function close(countedCashInDrawerCents: number, note?: string) {
    if (!organizationId || !user || !session) throw new Error('Caixa fechado.')
    setBusy(true)
    setError(null)
    try {
      await closeCashSession({
        organizationId,
        sessionId: session.id,
        userId: user.id,
        userName: user.displayName || user.email,
        countedCashInDrawerCents,
        note,
      })
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Falha ao fechar o caixa.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  return {
    organization,
    user,
    session,
    summary,
    recent,
    loading,
    busy,
    error,
    refresh,
    open,
    move,
    close,
    movementTypes: CASH_MOVEMENT_TYPES,
  }
}
