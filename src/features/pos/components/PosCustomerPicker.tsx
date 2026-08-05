import { useEffect, useState } from 'react'
import {
  createCustomer,
  listCustomers,
  type Customer,
  type CustomerInput,
} from '../../customers'
import { useAuth } from '../../../shared/hooks/useAuth'
import { CustomerForm } from '../../customers/components/CustomerForm'
import { usePosOperator } from '../hooks/usePosOperator'
import { PinAuthorizeModal } from './PinAuthorizeModal'
import './PosCustomerPicker.css'

interface PosCustomerPickerProps {
  currentId?: string | null
  onSelect: (customer: { id: string; name: string } | null) => void
  onClose: () => void
}

export function PosCustomerPicker({
  currentId,
  onSelect,
  onClose,
}: PosCustomerPickerProps) {
  const { organization } = useAuth()
  const { pinRequired, canAccessBackOffice, authorizePrivileged } = usePosOperator()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [askPin, setAskPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function loadCustomers() {
    if (!organization?.id) return
    setLoading(true)
    try {
      setCustomers(await listCustomers(organization.id))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCustomers()
  }, [organization?.id])

  const filtered = customers.filter((customer) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [customer.name, customer.phone, customer.document]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  })

  function requestCreate() {
    setCreateError(null)
    if (!pinRequired || canAccessBackOffice) {
      setMode('create')
      return
    }
    setAskPin(true)
  }

  async function handleAuthorize(pin: string) {
    await authorizePrivileged(pin)
    setAskPin(false)
    setMode('create')
  }

  async function handleCreate(input: CustomerInput) {
    if (!organization?.id) return
    setSaving(true)
    setCreateError(null)
    try {
      const created = await createCustomer(organization.id, input)
      onSelect({ id: created.id, name: created.name })
      onClose()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Não foi possível cadastrar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pos-customer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pos-customer__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="pos-customer__card">
        <header>
          <h2>{mode === 'create' ? 'Novo cliente' : 'Cliente da venda'}</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        {mode === 'create' ? (
          <div className="pos-customer__form">
            <CustomerForm
              saving={saving}
              onSubmit={handleCreate}
              onCancel={() => setMode('list')}
            />
            {createError && (
              <p className="pos-customer__empty" role="alert">
                {createError}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="pos-customer__top-actions">
              <button
                type="button"
                className={
                  !currentId
                    ? 'pos-customer__livre pos-customer__livre--active'
                    : 'pos-customer__livre'
                }
                onClick={() => {
                  onSelect(null)
                  onClose()
                }}
              >
                Caixa livre
              </button>
              <button type="button" className="pos-customer__new" onClick={requestCreate}>
                Novo cliente
              </button>
            </div>

            <input
              type="search"
              placeholder="Buscar cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            {loading ? (
              <p className="pos-customer__empty">Carregando…</p>
            ) : filtered.length === 0 ? (
              <p className="pos-customer__empty">Nenhum cliente encontrado.</p>
            ) : (
              <ul>
                {filtered.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className={
                        currentId === customer.id ? 'pos-customer__item--active' : undefined
                      }
                      onClick={() => {
                        onSelect({ id: customer.id, name: customer.name })
                        onClose()
                      }}
                    >
                      <strong>{customer.name}</strong>
                      <span>{customer.phone || customer.document || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {askPin && (
        <PinAuthorizeModal
          title="Cadastrar cliente"
          description="Só proprietário ou gerente pode cadastrar cliente no PDV. Digite o PIN para autorizar."
          onConfirm={handleAuthorize}
          onCancel={() => setAskPin(false)}
        />
      )}
    </div>
  )
}
