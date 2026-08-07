import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPlanPrice } from '../../billing'
import { formatMoney } from '../../../shared/lib/money'
import { ReceivableForm } from '../components/ReceivableForm'
import { ReceivableList } from '../components/ReceivableList'
import { ReceivePaymentForm } from '../components/ReceivePaymentForm'
import { useReceivables } from '../hooks/useReceivables'
import type {
  CreateReceivableInput,
  ReceivePaymentInput,
  Receivable,
} from '../types'
import './ReceivablesPage.css'

type Mode = 'list' | 'create' | 'receive'

export function ReceivablesPage() {
  const {
    organization,
    hasReceivables,
    upgradeHint,
    items,
    openTotalCents,
    customers,
    loading,
    saving,
    error,
    search,
    setSearch,
    includePaid,
    setIncludePaid,
    addReceivable,
    payReceivable,
  } = useReceivables()

  const [mode, setMode] = useState<Mode>('list')
  const [receiving, setReceiving] = useState<Receivable | null>(null)

  async function handleCreate(input: CreateReceivableInput) {
    await addReceivable(input)
    setMode('list')
  }

  async function handleReceive(input: ReceivePaymentInput) {
    if (!receiving) return
    await payReceivable(receiving.id, input)
    setReceiving(null)
    setMode('list')
  }

  if (!organization) {
    return <p className="receivables-page__empty">Nenhuma loja ativa.</p>
  }

  if (!hasReceivables) {
    return (
      <section className="receivables-page">
        <header className="receivables-page__header">
          <div>
            <h1>Contas a receber</h1>
            <p>Fiado e recebimentos do comércio.</p>
          </div>
        </header>
        <div className="receivables-page__upsell">
          <h2>Disponível a partir do Equipe</h2>
          <p>
            {upgradeHint} Controle fiado por cliente, baixas parciais e vínculo com
            vendas do PDV.
          </p>
          <p>
            Equipe: {formatPlanPrice('essencial')} · Gestão:{' '}
            {formatPlanPrice('controle')}
          </p>
          <Link to="/app/billing" className="receivables-page__upsell-link">
            Ver planos
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="receivables-page">
      <header className="receivables-page__header">
        <div>
          <h1>Contas a receber</h1>
          <p>
            {organization.name}
            {` · em aberto ${formatMoney(openTotalCents)}`}
          </p>
        </div>
        {mode === 'list' && (
          <button
            type="button"
            className="receivables-page__cta"
            onClick={() => setMode('create')}
          >
            Lançar fiado
          </button>
        )}
      </header>

      {error && (
        <p className="receivables-page__error" role="alert">
          {error}
        </p>
      )}

      {mode === 'create' ? (
        <ReceivableForm
          customers={customers}
          saving={saving}
          onSubmit={handleCreate}
          onCancel={() => setMode('list')}
        />
      ) : mode === 'receive' && receiving ? (
        <ReceivePaymentForm
          receivable={receiving}
          saving={saving}
          onSubmit={handleReceive}
          onCancel={() => {
            setReceiving(null)
            setMode('list')
          }}
        />
      ) : (
        <>
          <div className="receivables-page__toolbar">
            <input
              type="search"
              placeholder="Buscar cliente ou descrição"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={includePaid}
                onChange={(e) => setIncludePaid(e.target.checked)}
              />
              Incluir quitados
            </label>
          </div>

          {loading ? (
            <p className="receivables-page__empty">Carregando…</p>
          ) : (
            <ReceivableList
              items={items}
              busy={saving}
              onReceive={(item) => {
                setReceiving(item)
                setMode('receive')
              }}
            />
          )}
        </>
      )}
    </section>
  )
}
