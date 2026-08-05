import { FISCAL_DISCLAIMER } from '../content'
import '../pages/LegalPage.css'

export function FiscalNotice({ className }: { className?: string }) {
  return <div className={className ? `${className} fiscal-notice` : 'fiscal-notice'}>{FISCAL_DISCLAIMER}</div>
}
