import { formatMoney } from '../../../shared/lib/money'
import type { Product } from '../types'
import './ProductList.css'

interface ProductListProps {
  products: Product[]
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  busy?: boolean
}

export function ProductList({ products, onEdit, onToggleActive, busy }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="product-list product-list--empty">
        Nenhum produto encontrado. Use <strong>Cadastrar / atualizar</strong> e comece pelo código.
      </div>
    )
  }

  return (
    <div className="product-list">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nome</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const lowStock =
              product.type === 'product' &&
              product.minStock > 0 &&
              product.stock <= product.minStock

            return (
              <tr key={product.id} className={product.active ? undefined : 'product-list__inactive'}>
                <td className="product-list__code" data-label="Código">
                  {product.barcode || '—'}
                </td>
                <td data-label="Nome">
                  <strong>{product.name}</strong>
                  <span className="product-list__meta">
                    {product.type === 'service' ? 'Serviço' : product.unit}
                    {product.category ? ` · ${product.category}` : ''}
                  </span>
                </td>
                <td data-label="Preço">{formatMoney(product.priceCents)}</td>
                <td data-label="Estoque">
                  {product.type === 'service' ? '—' : product.stock}
                  {lowStock && <span className="product-list__warn"> baixo</span>}
                </td>
                <td data-label="Status">{product.active ? 'Ativo' : 'Inativo'}</td>
                <td className="product-list__actions" data-label="Ações">
                  <button type="button" onClick={() => onEdit(product)} disabled={busy}>
                    Abrir
                  </button>
                  <button type="button" onClick={() => onToggleActive(product)} disabled={busy}>
                    {product.active ? 'Desativar' : 'Reativar'}
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
