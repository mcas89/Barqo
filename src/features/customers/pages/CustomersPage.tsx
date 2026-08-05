import { useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { CustomerForm } from '../components/CustomerForm'
import { CustomerList } from '../components/CustomerList'
import { useCustomers } from '../hooks/useCustomers'
import type { Customer, CustomerInput } from '../types'
import './CustomersPage.css'

export function CustomersPage() {
  const { organization } = useAuth()
  const {
    customers,
    totalCount,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    saveCustomer,
    toggleActive,
  } = useCustomers()

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Customer | null>(null)

  function openCreate() {
    setEditing(null)
    setMode('form')
  }

  function openEdit(customer: Customer) {
    setEditing(customer)
    setMode('form')
  }

  function closeForm() {
    setEditing(null)
    setMode('list')
  }

  async function handleSubmit(input: CustomerInput) {
    await saveCustomer(input, editing?.id)
    closeForm()
  }

  if (!organization) {
    return <p className="customers-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="customers-page">
      <header className="customers-page__header">
        <div>
          <h1>Clientes</h1>
          <p>
            {mode === 'form'
              ? editing
                ? `Editar ${editing.name}`
                : 'Novo cliente'
              : (
                <>
                  {organization.name}
                  {totalCount > 0 ? ` · ${totalCount} cliente(s)` : ''}
                </>
              )}
          </p>
        </div>
        {mode === 'list' && (
          <button type="button" className="customers-page__cta" onClick={openCreate}>
            Cadastrar
          </button>
        )}
      </header>

      {error && (
        <p className="customers-page__error" role="alert">
          {error}
        </p>
      )}

      {mode === 'form' ? (
        <CustomerForm
          initial={editing}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : (
        <>
          <div className="customers-page__toolbar">
            <input
              type="search"
              placeholder="Buscar por nome, telefone ou documento"
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
            <p className="customers-page__empty">Carregando clientes…</p>
          ) : (
            <CustomerList
              customers={customers}
              onEdit={openEdit}
              onToggleActive={(customer) => void toggleActive(customer)}
              busy={saving}
            />
          )}
        </>
      )}
    </section>
  )
}
