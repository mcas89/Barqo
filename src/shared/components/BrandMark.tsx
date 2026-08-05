import { APP_NAME, BALQO_LOGO_SRC, resolveThemeColor } from '../constants'
import type { Organization } from '../types'
import './BrandMark.css'

interface BrandMarkProps {
  organization?: Organization | null
  compact?: boolean
}

export function BrandMark({ organization, compact }: BrandMarkProps) {
  const src = organization?.logoDataUrl || BALQO_LOGO_SRC
  const alt = organization?.name || APP_NAME
  const color = resolveThemeColor(organization?.themeColor)

  return (
    <div
      className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'}
      style={{ ['--balqo-brand' as string]: color }}
    >
      <img src={src} alt={alt} />
    </div>
  )
}
