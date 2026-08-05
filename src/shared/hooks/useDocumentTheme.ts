import { useEffect } from 'react'
import { themeCssVars } from '../constants'

export function useDocumentTheme(color?: string | null) {
  useEffect(() => {
    const root = globalThis.document?.documentElement
    if (!root?.style || typeof themeCssVars !== 'function') return

    const vars = themeCssVars(color)
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') root.style.setProperty(key, value)
    }
    return () => {
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key)
      }
    }
  }, [color])
}
