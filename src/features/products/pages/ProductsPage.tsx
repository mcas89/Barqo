import { useMemo, useState } from 'react'
import { recordBarcodeAudit, recordLabelsPrinted } from '../../audit'
import { LabelPrintModal, type LabelPrintItem } from '../../labels'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { PERMISSIONS } from '../../users/permissions'
import { ProductForm } from '../components/ProductForm'
import { ProductList } from '../components/ProductList'
import { useProducts } from '../hooks/useProducts'
import { productHasBarcode } from '../services/barcode-service'
import {
  generateInternalBarcodeForProduct,
  generateMissingBarcodes,
} from '../services/product-service'
import type { Product, ProductInput } from '../types'
import './ProductsPage.css'

export function ProductsPage() {
  const { organization } = useAuth()
  const { deviceId } = useDeviceSession()
  const { operator, can } = usePosOperator()
  const {
    products,
    allProducts,
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
    refresh,
    setErrorMessage,
  } = useProducts()

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchNotice, setBatchNotice] = useState<string | null>(null)
  const [labelItems, setLabelItems] = useState<LabelPrintItem[] | null>(null)

  const canGenerate = can(PERMISSIONS.GENERATE_BARCODE)
  const canChange = can(PERMISSIONS.CHANGE_BARCODE)
  const canPrint = can(PERMISSIONS.LABELS_PRINT)

  const selectedProducts = useMemo(
    () => allProducts.filter((product) => selectedIds.has(product.id)),
    [allProducts, selectedIds],
  )

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
    const previous = editing?.barcode
    await saveProduct(input, editing?.id)
    if (
      organization &&
      operator &&
      previous &&
      input.barcode &&
      previous !== input.barcode.trim()
    ) {
      void recordBarcodeAudit({
        organizationId: organization.id,
        type: 'product.barcode.changed',
        productId: editing!.id,
        operatorId: operator.id,
        deviceId: deviceId || 'unknown',
        previousBarcode: previous,
        newBarcode: input.barcode.trim(),
      })
    }
    closeForm()
  }

  function toggleSelect(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(products.map((product) => product.id)))
  }

  async function handleGenerateOne(product: Product): Promise<Product | null> {
    if (!organization || !canGenerate) return null
    setBatchNotice(null)
    try {
      const updated = await generateInternalBarcodeForProduct({
        organizationId: organization.id,
        productId: product.id,
        operatorId: operator?.id,
      })
      void recordBarcodeAudit({
        organizationId: organization.id,
        type: 'product.barcode.generated',
        productId: product.id,
        operatorId: operator?.id ?? 'unknown',
        deviceId: deviceId || 'unknown',
        newBarcode: updated.barcode,
      })
      setBatchNotice(`Código interno criado com sucesso.\n${updated.barcode}`)
      if (editing?.id === product.id) setEditing(updated)
      await refresh()
      return updated
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao gerar código.')
      return null
    }
  }

  async function handleGenerateMissing() {
    if (!organization || !canGenerate || selectedProducts.length === 0) return
    setBatchNotice(null)
    try {
      const result = await generateMissingBarcodes({
        organizationId: organization.id,
        productIds: selectedProducts.map((product) => product.id),
        operatorId: operator?.id,
      })
      if (result.generated === 0) {
        setBatchNotice(
          'Nenhum código foi gerado.\nTodos os produtos selecionados já possuem código de barras.',
        )
      } else {
        setBatchNotice(
          `Geração concluída.\n${result.generated} código(s) foram gerados.\n${result.preserved} produto(s) já possuíam código e foram preservados.`,
        )
        for (const product of result.products) {
          if (!product.barcode) continue
          const wasMissing = selectedProducts.find(
            (item) => item.id === product.id && !productHasBarcode(item),
          )
          if (!wasMissing) continue
          void recordBarcodeAudit({
            organizationId: organization.id,
            type: 'product.barcode.generated',
            productId: product.id,
            operatorId: operator?.id ?? 'unknown',
            deviceId: deviceId || 'unknown',
            newBarcode: product.barcode,
          })
        }
      }
      await refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha na geração em lote.')
    }
  }

  function openLabelsFor(productsToPrint: Product[]) {
    setLabelItems(
      productsToPrint.map((product) => ({
        productId: product.id,
        name: product.name,
        barcode: product.barcode?.trim() || '',
        priceCents: product.priceCents,
        unit: product.unit,
        quantity: product.barcode ? 1 : 0,
      })),
    )
  }

  async function openLabelAfterGenerate(product: Product) {
    if (!product.barcode) {
      const ok = window.confirm(
        'Este produto ainda não possui código de barras.\n\nGerar código e continuar?',
      )
      if (!ok) return
      const updated = await handleGenerateOne(product)
      if (updated?.barcode) openLabelsFor([updated])
      return
    }
    openLabelsFor([product])
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
              ? 'Identificação, código de barras e preço do item.'
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

      {(error || batchNotice) && (
        <p
          className={error ? 'products-page__error' : 'products-page__notice'}
          role={error ? 'alert' : 'status'}
        >
          {error || batchNotice}
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
          canGenerate={canGenerate}
          canChange={canChange}
          canPrint={canPrint}
          onGenerateSaved={
            editing
              ? async () => {
                  await handleGenerateOne(editing)
                }
              : undefined
          }
          onPrintLabel={editing ? () => void openLabelAfterGenerate(editing) : undefined}
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

          {selectedIds.size > 0 && (
            <div className="products-page__batch" role="region" aria-label="Ações em lote">
              <strong>{selectedIds.size} produto(s) selecionado(s)</strong>
              <div className="products-page__batch-actions">
                {canGenerate && (
                  <button type="button" onClick={() => void handleGenerateMissing()} disabled={saving}>
                    Gerar códigos ausentes
                  </button>
                )}
                {canPrint && (
                  <button
                    type="button"
                    onClick={() => openLabelsFor(selectedProducts)}
                    disabled={saving}
                  >
                    Imprimir etiquetas
                  </button>
                )}
                <button type="button" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="products-page__empty">Carregando produtos…</p>
          ) : (
            <ProductList
              products={products}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onEdit={openEdit}
              onToggleActive={(product) => void toggleActive(product)}
              onGenerateBarcode={(product) => void handleGenerateOne(product)}
              onPrintLabel={openLabelAfterGenerate}
              busy={saving}
              canGenerate={canGenerate}
              canPrint={canPrint}
            />
          )}
        </>
      )}

      {labelItems && (
        <LabelPrintModal
          storeName={organization.name}
          items={labelItems}
          onChangeQuantity={(productId, quantity) => {
            setLabelItems((current) =>
              current
                ? current.map((item) =>
                    item.productId === productId ? { ...item, quantity } : item,
                  )
                : current,
            )
          }}
          onUseStockQuantities={() => {
            setLabelItems((current) =>
              current
                ? current.map((item) => {
                    const product = allProducts.find((row) => row.id === item.productId)
                    if (!product || !item.barcode) return item
                    return {
                      ...item,
                      quantity: Math.max(1, Math.floor(product.stock) || 1),
                    }
                  })
                : current,
            )
          }}
          onClose={() => setLabelItems(null)}
          onPrinted={({ modelId, totalLabels }) => {
            void recordLabelsPrinted({
              organizationId: organization.id,
              operatorId: operator?.id ?? 'unknown',
              deviceId: deviceId || 'unknown',
              modelId,
              totalLabels,
              productIds: labelItems.map((item) => item.productId),
            })
          }}
        />
      )}
    </section>
  )
}
