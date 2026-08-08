import { formatDateTime } from '../../../shared/lib/dates'
import { formatMoney } from '../../../shared/lib/money'
import { useReprintSale } from '../../receipts'
import type { Sale } from '../types'
import './PosRecentSalesPanel.css'

interface PosRecentSalesPanelProps {
  sales: Sale[]
  loading: boolean
  offerWhatsapp?: boolean
  onWhatsapp?: (sale: Sale) => void
  onClose: () => void
}

export function PosRecentSalesPanel({
  sales,
  loading,
  offerWhatsapp,
  onWhatsapp,
  onClose,
}: PosRecentSalesPanelProps) {
  const { reprint, busyId } = useReprintSale()

  return (
    <div className="pos-recent-sales" role="dialog" aria-labelledby="pos-recent-sales-title">
      <button type="button" className="pos-recent-sales__backdrop" aria-label="Fechar" onClick={onClose} />
      <div className="pos-recent-sales__card">
        <header>
          <div>
            <h2 id="pos-recent-sales-title">2ª via</h2>
            <p>Últimas 5 vendas deste caixa</p>
          </div>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        {loading ? (
          <p className="pos-recent-sales__empty">Carregando vendas…</p>
        ) : sales.length === 0 ? (
          <p className="pos-recent-sales__empty">Nenhuma venda recente para reimprimir.</p>
        ) : (
          <ul>
            {sales.map((sale) => (
              <li key={sale.id}>
                <div>
                  <strong>{formatMoney(sale.totalCents)}</strong>
                  <span>
                    {formatDateTime(sale.createdAt)}
                    {sale.customerName ? ` · ${sale.customerName}` : ' · -'}
                  </span>
                </div>
                <div className="pos-recent-sales__actions">
                  {offerWhatsapp && onWhatsapp && (
                    <button
                      type="button"
                      className="pos-recent-sales__whatsapp"
                      onClick={() => onWhatsapp(sale)}
                    >
                      WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void reprint(sale)}
                    disabled={busyId === sale.id}
                  >
                    {busyId === sale.id ? 'Imprimindo…' : 'Imprimir'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
