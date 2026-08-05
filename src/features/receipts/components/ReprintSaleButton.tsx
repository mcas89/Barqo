import type { Sale } from '../../pos/types'
import { useReprintSale } from '../hooks/useReprintSale'
import './ReprintSaleButton.css'

export function ReprintSaleButton({ sale }: { sale: Sale }) {
  const { reprint, busyId } = useReprintSale()
  const busy = busyId === sale.id

  return (
    <button
      type="button"
      className="reprint-sale-btn"
      onClick={() => void reprint(sale)}
      disabled={busy}
    >
      {busy ? 'Imprimindo…' : '2ª via'}
    </button>
  )
}
