import type { Customer } from '../types'
import './CustomerList.css'

interface CustomerListProps {
  customers: Customer[]
  onEdit: (customer: Customer) => void
  onToggleActive: (customer: Customer) => void
  busy?: boolean
}

export function CustomerList({
  customers,
  onEdit,
  onToggleActive,
  busy,
}: CustomerListProps) {
  if (customers.length === 0) {
    return <p className="customer-list__empty">Nenhum cliente cadastrado.</p>
  }

  return (
    <ul className="customer-list">
      {customers.map((customer) => (
        <li
          key={customer.id}
          className={
            customer.active
              ? 'customer-list__item'
              : 'customer-list__item customer-list__item--inactive'
          }
        >
          <div>
            <strong>{customer.name}</strong>
            <span>
              {[customer.phone, customer.document].filter(Boolean).join(' · ') ||
                'Sem contato'}
            </span>
          </div>
          <div className="customer-list__actions">
            <button type="button" onClick={() => onEdit(customer)} disabled={busy}>
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(customer)}
              disabled={busy}
            >
              {customer.active ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
