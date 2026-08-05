import { formatMoney } from '../../../shared/lib/money'
import type { Product } from '../types'
import { productHasBarcode } from '../services/barcode-service'
import './ProductList.css'

interface ProductListProps {
  products: Product[]
  selectedIds: Set<string>
  onToggleSelect: (productId: string) => void
  onToggleSelectAll: (checked: boolean) => void
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  onGenerateBarcode: (product: Product) => void
  onPrintLabel: (product: Product) => void
  busy?: boolean
  canGenerate?: boolean
  canPrint?: boolean
}

export function ProductList({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onToggleActive,
  onGenerateBarcode,
  onPrintLabel,
  busy,
  canGenerate = true,
  canPrint = true,
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="product-list product-list--empty">
        Nenhum produto encontrado. Use <strong>Cadastrar / atualizar</strong> e comece pelo código.
      </div>
    )
  }

  const allSelected = products.every((product) => selectedIds.has(product.id))

  return (
    <div className="product-list">
      <table>
        <thead>
          <tr>
            <th className="product-list__check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label="Selecionar todos"
              />
            </th>
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
            const hasCode = productHasBarcode(product)

            return (
              <tr key={product.id} className={product.active ? undefined : 'product-list__inactive'}>
                <td className="product-list__check" data-label="Sel.">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => onToggleSelect(product.id)}
                    aria-label={`Selecionar ${product.name}`}
                  />
                </td>
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
                  {!hasCode && canGenerate && (
                    <button
                      type="button"
                      onClick={() => onGenerateBarcode(product)}
                      disabled={busy}
                    >
                      Gerar código
                    </button>
                  )}
                  {canPrint && (
                    <button type="button" onClick={() => onPrintLabel(product)} disabled={busy}>
                      Etiqueta
                    </button>
                  )}
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
