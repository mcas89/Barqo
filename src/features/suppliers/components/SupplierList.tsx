import type { Supplier } from '../types'
import './SupplierList.css'

interface SupplierListProps {
  suppliers: Supplier[]
  onEdit: (supplier: Supplier) => void
  onToggleActive: (supplier: Supplier) => void
  busy?: boolean
}

export function SupplierList({
  suppliers,
  onEdit,
  onToggleActive,
  busy,
}: SupplierListProps) {
  if (suppliers.length === 0) {
    return <p className="supplier-list__empty">Nenhum fornecedor cadastrado.</p>
  }

  return (
    <ul className="supplier-list">
      {suppliers.map((supplier) => (
        <li
          key={supplier.id}
          className={
            supplier.active
              ? 'supplier-list__item'
              : 'supplier-list__item supplier-list__item--inactive'
          }
        >
          <div>
            <strong>{supplier.name}</strong>
            <span>
              {[supplier.category, supplier.contactName, supplier.phone]
                .filter(Boolean)
                .join(' · ') || 'Sem contato'}
            </span>
          </div>
          <div className="supplier-list__actions">
            <button type="button" onClick={() => onEdit(supplier)} disabled={busy}>
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(supplier)}
              disabled={busy}
            >
              {supplier.active ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
