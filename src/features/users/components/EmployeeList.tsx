import {
  EMPLOYEE_ROLE_LABELS,
  type Employee,
} from '../types'
import './EmployeeList.css'

interface EmployeeListProps {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  onToggleActive: (employee: Employee) => void
  busy?: boolean
  canManage?: boolean
}

export function EmployeeList({
  employees,
  onEdit,
  onToggleActive,
  busy,
  canManage = true,
}: EmployeeListProps) {
  if (employees.length === 0) {
    return <p className="employee-list__empty">Nenhum funcionário cadastrado.</p>
  }

  return (
    <ul className="employee-list">
      {employees.map((employee) => (
        <li
          key={employee.id}
          className={
            employee.active
              ? 'employee-list__item'
              : 'employee-list__item employee-list__item--inactive'
          }
        >
          <div>
            <strong>{employee.displayName}</strong>
            <span>{EMPLOYEE_ROLE_LABELS[employee.role]}</span>
          </div>
          {canManage && (
            <div className="employee-list__actions">
              <button
                type="button"
                onClick={() => onEdit(employee)}
                disabled={busy}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onToggleActive(employee)}
                disabled={busy}
              >
                {employee.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
