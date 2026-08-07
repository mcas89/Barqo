import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatPlanPrice, getPlan } from '../../billing'
import { useAuth } from '../../../shared/hooks/useAuth'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { EmployeeForm } from '../components/EmployeeForm'
import { EmployeeList } from '../components/EmployeeList'
import { useTeam } from '../hooks/useTeam'
import type { Employee, EmployeeInput } from '../types'
import './TeamPage.css'

export function TeamPage() {
  const { organization, user } = useAuth()
  const { operators, setupOwnerPin, refreshOperators, pinRequired } = usePosOperator()
  const {
    employees,
    seatsUsed,
    maxUsers,
    planId,
    hasMultiUser,
    hasFinePermissions,
    canManage,
    canAddEmployee,
    blockReason,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    saveEmployee,
    toggleActive,
  } = useTeam()

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [ownerPin, setOwnerPin] = useState('')
  const [ownerPinConfirm, setOwnerPinConfirm] = useState('')
  const [ownerPinBusy, setOwnerPinBusy] = useState(false)
  const [ownerPinMsg, setOwnerPinMsg] = useState<string | null>(null)

  const plan = getPlan(planId)
  const ownerOp = operators.find((op) => op.kind === 'owner')

  function openCreate() {
    setEditing(null)
    setMode('form')
  }

  function openEdit(employee: Employee) {
    setEditing(employee)
    setMode('form')
  }

  function closeForm() {
    setEditing(null)
    setMode('list')
  }

  async function handleSubmit(input: EmployeeInput) {
    await saveEmployee(input, editing?.id)
    await refreshOperators()
    closeForm()
  }

  async function handleOwnerPin(event: FormEvent) {
    event.preventDefault()
    setOwnerPinMsg(null)
    if (ownerPin !== ownerPinConfirm) {
      setOwnerPinMsg('Os PINs não conferem.')
      return
    }
    setOwnerPinBusy(true)
    try {
      await setupOwnerPin(ownerPin)
      setOwnerPin('')
      setOwnerPinConfirm('')
      setOwnerPinMsg('PIN do proprietário salvo. Use-o para entrar no sistema.')
    } catch (err) {
      setOwnerPinMsg(err instanceof Error ? err.message : 'Falha ao salvar PIN.')
    } finally {
      setOwnerPinBusy(false)
    }
  }

  if (!organization) {
    return <p className="team-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="team-page">
      <header className="team-page__header">
        <div>
          <h1>Equipe</h1>
          <p>
            {mode === 'form'
              ? editing
                ? `Editar ${editing.displayName}`
                : 'Novo funcionário com PIN para o PDV'
              : (
                <>
                  {organization.name} · Plano {plan.name} · {seatsUsed}/{maxUsers}{' '}
                  usuários
                </>
              )}
          </p>
        </div>
        {mode === 'list' && canManage && hasMultiUser && (
          <button
            type="button"
            className="team-page__cta"
            onClick={openCreate}
            disabled={!canAddEmployee}
            title={!canAddEmployee ? (blockReason ?? undefined) : undefined}
          >
            Adicionar
          </button>
        )}
      </header>

      {error && (
        <p className="team-page__error" role="alert">
          {error}
        </p>
      )}

      {mode === 'list' && pinRequired && (
        <form className="team-page__owner-pin" onSubmit={(e) => void handleOwnerPin(e)}>
          <div>
            <strong>{ownerOp?.displayName ?? user?.displayName ?? 'Proprietário'}</strong>
            <span>
              PIN para entrar no sistema
              {ownerOp?.hasPin ? ' · já cadastrado (pode trocar)' : ' · ainda não definido'}
            </span>
          </div>
          <div className="team-page__owner-pin-fields">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Novo PIN"
              value={ownerPin}
              onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={ownerPinBusy || !canManage}
              required
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirmar"
              value={ownerPinConfirm}
              onChange={(e) =>
                setOwnerPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              disabled={ownerPinBusy || !canManage}
              required
            />
            <button type="submit" disabled={ownerPinBusy || !canManage || ownerPin.length < 4}>
              {ownerPinBusy ? 'Salvando…' : ownerOp?.hasPin ? 'Trocar PIN' : 'Definir PIN'}
            </button>
          </div>
          {ownerPinMsg && <p className="team-page__owner-pin-msg">{ownerPinMsg}</p>}
        </form>
      )}

      {mode === 'list' && !hasMultiUser && (
        <div className="team-page__upsell">
          <h2>Plano Solo: só o proprietário</h2>
          <p>
            No Solo o PDV abre direto com o proprietário, sem PIN. Para cadastrar
            funcionários com PIN, suba para o Equipe ({formatPlanPrice('essencial')})
            ou Gestão ({formatPlanPrice('controle')}).
          </p>
          <Link to="/app/billing" className="team-page__upsell-link">
            Ver planos
          </Link>
        </div>
      )}

      {mode === 'list' && hasMultiUser && !canAddEmployee && canManage && (
        <p className="team-page__limit">{blockReason}</p>
      )}

      {mode === 'form' ? (
        <EmployeeForm
          initial={editing}
          saving={saving}
          finePermissions={hasFinePermissions}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : hasMultiUser ? (
        <>
          <div className="team-page__toolbar">
            <input
              type="search"
              placeholder="Buscar funcionário"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inativos
            </label>
          </div>

          {loading ? (
            <p className="team-page__empty">Carregando equipe…</p>
          ) : (
            <EmployeeList
              employees={employees}
              onEdit={openEdit}
              onToggleActive={(employee) => void toggleActive(employee)}
              busy={saving}
              canManage={canManage}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
