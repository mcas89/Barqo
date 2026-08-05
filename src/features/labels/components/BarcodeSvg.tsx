import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeSvgProps {
  value: string
  height?: number
  displayValue?: boolean
  className?: string
}

export function BarcodeSvg({
  value,
  height = 48,
  displayValue = false,
  className,
}: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value.trim()) return
    try {
      JsBarcode(svgRef.current, value.trim(), {
        format: 'CODE128',
        displayValue,
        height,
        margin: 0,
        fontSize: 12,
        textMargin: 2,
        background: 'transparent',
      })
    } catch {
      // valor inválido para Code128 — deixa SVG vazio
    }
  }, [value, height, displayValue])

  if (!value.trim()) return null
  return <svg ref={svgRef} className={className} role="img" aria-label={value} />
}
