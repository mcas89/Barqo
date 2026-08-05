import { useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { ProductForm } from '../components/ProductForm'
import { ProductList } from '../components/ProductList'
import { useProducts } from '../hooks/useProducts'
import type { Product, ProductInput } from '../types'
import './ProductsPage.css'

export function ProductsPage() {
  const { organization } = useAuth()
  const {
    products,
    totalCount,
    loading,
    saving,
    error,
    search,
    setSearch,
    showInactive,
    setShowInactive,
    saveProduct,
    toggleActive,
    findByBarcode,
  } = useProducts()

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Product | null>(null)

  function openCreate() {
    setEditing(null)
    setMode('form')
  }

  function openEdit(product: Product) {
    setEditing(product)
    setMode('form')
  }

  function closeForm() {
    setEditing(null)
    setMode('list')
  }

  async function handleSubmit(input: ProductInput) {
    await saveProduct(input, editing?.id)
    closeForm()
  }

  if (!organization) {
    return <p className="products-page__empty">Nenhuma loja ativa.</p>
  }

  return (
    <section className="products-page">
      <header className="products-page__header">
        <div>
          <h1>Produtos</h1>
          <p>
            {mode === 'form'
              ? 'Comece pelo código de barras para cadastrar ou atualizar rápido.'
              : (
                <>
                  Catálogo de <strong>{organization.name}</strong>
                  {totalCount > 0 ? ` · ${totalCount} item(ns)` : ''}
                </>
              )}
          </p>
        </div>
        {mode === 'list' && (
          <button type="button" className="products-page__cta" onClick={openCreate}>
            Cadastrar / atualizar
          </button>
        )}
      </header>

      {error && (
        <p className="products-page__error" role="alert">
          {error}
        </p>
      )}

      {mode === 'form' ? (
        <ProductForm
          initial={editing}
          saving={saving}
          findByBarcode={findByBarcode}
          onResolvedProduct={setEditing}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : (
        <>
          <div className="products-page__toolbar">
            <input
              type="search"
              placeholder="Buscar por código, nome ou categoria"
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
            <p className="products-page__empty">Carregando produtos…</p>
          ) : (
            <ProductList
              products={products}
              onEdit={openEdit}
              onToggleActive={(product) => void toggleActive(product)}
              busy={saving}
            />
          )}
        </>
      )}
    </section>
  )
}
