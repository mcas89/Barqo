import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import { SupplierForm } from '../components/SupplierForm'
import { SupplierList } from '../components/SupplierList'
import { useSuppliers } from '../hooks/useSuppliers'
import type { Supplier, SupplierInput } from '../types'
import './SuppliersPage.css'

export function SuppliersPage() {
  const { organization } = useAuth()
  const {
    suppliers,
    totalCount,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    saveSupplier,
    toggleActive,
  } = useSuppliers()

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Supplier | null>(null)

  function openCreate() {
    setEditing(null)
    setMode('form')
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setMode('form')
  }

  function closeForm() {
    setEditing(null)
    setMode('list')
  }

  async function handleSubmit(input: SupplierInput) {
    await saveSupplier(input, editing?.id)
    closeForm()
  }

  if (!organization) {
    return <p className="suppliers-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="suppliers-page">
      <header className="suppliers-page__header">
        <div>
          <h1>Fornecedores</h1>
          <p>
            {mode === 'form'
              ? editing
                ? `Editar ${editing.name}`
                : 'Novo fornecedor'
              : (
                <>
                  Agenda de reposição de <strong>{organization.name}</strong>
                  {totalCount > 0 ? ` · ${totalCount}` : ''}
                </>
              )}
          </p>
        </div>
        {mode === 'list' && (
          <button type="button" className="suppliers-page__cta" onClick={openCreate}>
            Cadastrar
          </button>
        )}
      </header>

      {error && (
        <p className="suppliers-page__error" role="alert">
          {error}
        </p>
      )}

      {mode === 'form' ? (
        <SupplierForm
          initial={editing}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : (
        <>
          <div className="suppliers-page__toolbar">
            <input
              type="search"
              placeholder="Buscar por nome, contato ou categoria"
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

          <p className="suppliers-page__hint">
            Cadastro simples para ligar e repor estoque. Sem pedidos avançados nesta versão.{' '}
            <Link to="/app/inventory">Ir para estoque</Link>
          </p>

          {loading ? (
            <p className="suppliers-page__empty">Carregando fornecedores…</p>
          ) : (
            <SupplierList
              suppliers={suppliers}
              onEdit={openEdit}
              onToggleActive={(supplier) => void toggleActive(supplier)}
              busy={saving}
            />
          )}
        </>
      )}
    </section>
  )
}
