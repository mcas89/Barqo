import type { Product } from '../../products'
import { isLowStock } from '../services/inventory-service'
import type { StockMoveMode } from './StockMoveForm'
import './InventoryList.css'

interface InventoryListProps {
  products: Product[]
  onMove: (product: Product, mode: StockMoveMode) => void
  busy?: boolean
}

export function InventoryList({ products, onMove, busy }: InventoryListProps) {
  if (products.length === 0) {
    return (
      <p className="inventory-list__empty">
        Nenhum produto de estoque. Cadastre produtos (tipo produto) primeiro.
      </p>
    )
  }

  return (
    <div className="inventory-list">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Saldo</th>
            <th>Mín.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const low = isLowStock(product)
            return (
              <tr
                key={product.id}
                className={low ? 'inventory-list__row--low' : undefined}
              >
                <td data-label="Produto">
                  <strong>{product.name}</strong>
                  <span>
                    {product.barcode || 'Sem código'}
                    {product.category ? ` · ${product.category}` : ''}
                  </span>
                </td>
                <td data-label="Saldo">
                  <strong>
                    {product.stock} {product.unit}
                  </strong>
                  {low && <em>baixo</em>}
                </td>
                <td data-label="Mín.">{product.minStock > 0 ? product.minStock : '—'}</td>
                <td className="inventory-list__actions" data-label="Ações">
                  <button
                    type="button"
                    onClick={() => onMove(product, 'entry')}
                    disabled={busy}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(product, 'loss')}
                    disabled={busy}
                  >
                    Perda
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(product, 'adjustment')}
                    disabled={busy}
                  >
                    Ajuste
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
