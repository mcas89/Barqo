import { useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../products/services/category-service'
import type { ProductCategory } from '../../products/types/category'
import { formatProductTextInput, normalizeProductText } from '../../products/types'
import './CategoriesSettingsModal.css'

export function CategoriesSettingsModal({
  canEdit,
  onClose,
}: {
  canEdit: boolean
  onClose: () => void
}) {
  const { organization } = useAuth()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function refresh() {
    if (!organization?.id) return
    setLoading(true)
    setError(null)
    try {
      setCategories(await listCategories(organization.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [organization?.id])

  async function handleCreate() {
    if (!organization?.id || !canEdit) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      await createCategory(organization.id, { name: draftName })
      setDraftName('')
      setOk('Categoria adicionada.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!organization?.id || !editingId || !canEdit) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      await updateCategory(organization.id, editingId, { name: editName })
      setEditingId(null)
      setEditName('')
      setOk('Categoria atualizada. Produtos com o nome antigo foram ajustados.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: ProductCategory) {
    if (!organization?.id || !canEdit) return
    const confirmed = window.confirm(
      `Excluir a categoria “${category.name}”?\n\nOs produtos desta categoria ficam sem categoria.`,
    )
    if (!confirmed) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      await deleteCategory(organization.id, category.id)
      if (editingId === category.id) {
        setEditingId(null)
        setEditName('')
      }
      setOk('Categoria excluída.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="categories-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="categories-modal-title"
    >
      <button
        type="button"
        className="categories-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="categories-modal__card">
        <header>
          <h2 id="categories-modal-title">Categorias de produtos</h2>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        <p className="categories-modal__lead">
          Use no cadastro de produtos. A categoria é opcional — quem não quiser, deixa em branco.
        </p>

        <div className="categories-modal__add">
          <label>
            Nova categoria
            <input
              value={draftName}
              onChange={(e) => setDraftName(formatProductTextInput(e.target.value))}
              placeholder="Ex.: BEBIDAS"
              disabled={!canEdit || saving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!canEdit || saving || !normalizeProductText(draftName)}
          >
            Adicionar
          </button>
        </div>

        {loading ? (
          <p className="categories-modal__empty">Carregando…</p>
        ) : categories.length === 0 ? (
          <p className="categories-modal__empty">Nenhuma categoria ainda.</p>
        ) : (
          <ul className="categories-modal__list">
            {categories.map((category) => (
              <li key={category.id}>
                {editingId === category.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(formatProductTextInput(e.target.value))}
                      disabled={saving}
                      autoFocus
                    />
                    <div className="categories-modal__row-actions">
                      <button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditName('')
                        }}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{category.name}</strong>
                    <div className="categories-modal__row-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(category.id)
                          setEditName(category.name)
                        }}
                        disabled={!canEdit || saving}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="categories-modal__danger"
                        onClick={() => void handleDelete(category)}
                        disabled={!canEdit || saving}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="categories-modal__error" role="alert">
            {error}
          </p>
        )}
        {ok && <p className="categories-modal__ok">{ok}</p>}
        {!canEdit && (
          <p className="categories-modal__hint">Somente proprietário ou gerente pode editar.</p>
        )}
      </div>
    </div>
  )
}
