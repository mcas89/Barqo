import { Link } from 'react-router-dom'
import '../pages/LegalPage.css'

export function LegalAccept({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="legal-accept">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span>
        Li e aceito os <Link to="/termos">Termos de uso</Link> e a{' '}
        <Link to="/privacidade">Política de privacidade</Link>. O BALQO não emite NF-e e o cupom
        não é documento fiscal.
      </span>
    </label>
  )
}
