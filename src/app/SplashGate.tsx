import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { SplashScreen } from '../shared/components/SplashScreen'

const MIN_VISIBLE_MS = 1600
const EXIT_MS = 480

export function SplashGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth()
  const startedAt = useRef(Date.now())
  const bootEl = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : document.getElementById('balqo-boot'),
  )
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (loading || exiting || !visible) return

    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current))
    const startExit = window.setTimeout(() => {
      setExiting(true)
      bootEl.current?.classList.add('balqo-boot--exit')
      window.setTimeout(() => {
        bootEl.current?.remove()
        bootEl.current = null
        setVisible(false)
      }, EXIT_MS)
    }, wait)

    return () => window.clearTimeout(startExit)
  }, [loading, exiting, visible])

  return (
    <>
      {children}
      {visible && !bootEl.current && <SplashScreen exiting={exiting} />}
    </>
  )
}
