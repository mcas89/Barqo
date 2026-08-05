import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../../products'
import { InventoryList } from '../components/InventoryList'
import { MovementList } from '../components/MovementList'
import { StockMoveForm, type StockMoveMode } from '../components/StockMoveForm'
import { useInventory } from '../hooks/useInventory'
import './InventoryPage.css'

export function InventoryPage() {
  const {
    organization,
    products,
    lowStockCount,
    movements,
    loading,
    saving,
    error,
    search,
    setSearch,
    onlyLowStock,
    setOnlyLowStock,
    addEntry,
    addLoss,
    adjustStock,
  } = useInventory()

  const [tab, setTab] = useState<'stock' | 'history'>('stock')
  const [moving, setMoving] = useState<{
    product: Product
    mode: StockMoveMode
  } | null>(null)

  async function handleMoveSubmit(value: {
    quantity?: number
    newStock?: number
    note: string
  }) {
    if (!moving) return
    const { product, mode } = moving

    if (mode === 'entry') {
      await addEntry({
        productId: product.id,
        quantity: value.quantity ?? 0,
        note: value.note,
      })
    } else if (mode === 'loss') {
      await addLoss({
        productId: product.id,
        quantity: value.quantity ?? 0,
        note: value.note,
      })
    } else {
      await adjustStock({
        productId: product.id,
        newStock: value.newStock ?? 0,
        note: value.note,
      })
    }

    setMoving(null)
  }

  if (!organization) {
    return <p className="inventory-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="inventory-page">
      <header className="inventory-page__header">
        <div>
          <h1>Estoque</h1>
          <p>
            {organization.name}
            {lowStockCount > 0 ? ` · ${lowStockCount} alerta(s) de mínimo` : ''}
          </p>
        </div>
        <div className="inventory-page__links">
          <Link to="/app/products" className="inventory-page__link">
            Produtos
          </Link>
          <Link to="/app/suppliers" className="inventory-page__link">
            Fornecedores
          </Link>
        </div>
      </header>

      {error && (
        <p className="inventory-page__error" role="alert">
          {error}
        </p>
      )}

      {moving ? (
        <StockMoveForm
          product={moving.product}
          mode={moving.mode}
          saving={saving}
          onSubmit={handleMoveSubmit}
          onCancel={() => setMoving(null)}
        />
      ) : (
        <>
          <div className="inventory-page__tabs">
            <button
              type="button"
              className={tab === 'stock' ? 'inventory-page__tab--active' : undefined}
              onClick={() => setTab('stock')}
            >
              Saldos
            </button>
            <button
              type="button"
              className={tab === 'history' ? 'inventory-page__tab--active' : undefined}
              onClick={() => setTab('history')}
            >
              Histórico
            </button>
          </div>

          {tab === 'stock' ? (
            <>
              <div className="inventory-page__toolbar">
                <input
                  type="search"
                  placeholder="Buscar produto ou código"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={onlyLowStock}
                    onChange={(e) => setOnlyLowStock(e.target.checked)}
                  />
                  Só estoque baixo
                </label>
              </div>

              {loading ? (
                <p className="inventory-page__empty">Carregando estoque…</p>
              ) : (
                <InventoryList
                  products={products}
                  busy={saving}
                  onMove={(product, mode) => setMoving({ product, mode })}
                />
              )}
            </>
          ) : loading ? (
            <p className="inventory-page__empty">Carregando histórico…</p>
          ) : (
            <MovementList movements={movements} />
          )}
        </>
      )}
    </section>
  )
}
