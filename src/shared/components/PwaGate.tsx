import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { subscribePwaUpdateCheck } from '../lib/pwa-updates'
import './PwaGate.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const UPDATE_CHECK_MS = 60 * 1000

export function PwaGate() {
  const location = useLocation()
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const [progress, setProgress] = useState(0)
  const [updating, setUpdating] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installingApp, setInstallingApp] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [checking, setChecking] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      registrationRef.current = registration

      const check = () => {
        void registration.update().catch(() => undefined)
      }

      check()
      window.setInterval(check, UPDATE_CHECK_MS)
      window.addEventListener('focus', check)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
  })

  useEffect(() => {
    return subscribePwaUpdateCheck(() => {
      setChecking(true)
      void registrationRef.current
        ?.update()
        .catch(() => undefined)
        .finally(() => {
          window.setTimeout(() => setChecking(false), 1200)
        })
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const syncStandalone = () => {
      setStandalone(media.matches || window.navigator.standalone === true)
    }
    syncStandalone()
    media.addEventListener?.('change', syncStandalone)

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallPrompt(null)
      setInstallingApp(false)
      setStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      media.removeEventListener?.('change', syncStandalone)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function applyUpdate() {
    setUpdating(true)
    setProgress(12)
    const timer = window.setInterval(() => {
      setProgress((value) => (value < 92 ? value + 8 : value))
    }, 180)
    try {
      await updateServiceWorker(true)
      setProgress(100)
    } catch {
      setUpdating(false)
      setProgress(0)
    } finally {
      window.clearInterval(timer)
    }
  }

  async function installApp() {
    if (!installPrompt) return
    setInstallingApp(true)
    setProgress(20)
    const timer = window.setInterval(() => {
      setProgress((value) => (value < 88 ? value + 10 : value))
    }, 160)
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setProgress(100)
    } finally {
      window.clearInterval(timer)
      setInstallingApp(false)
      setInstallPrompt(null)
      setProgress(0)
    }
  }

  if (updating || installingApp) {
    const label = updating ? 'Atualizando o BALQO…' : 'Instalando o BALQO…'
    return (
      <aside className="pwa-gate pwa-gate--progress" role="status" aria-live="polite">
        <strong>{label}</strong>
        <div className="pwa-gate__track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <em>{progress}%</em>
      </aside>
    )
  }

  if (needRefresh) {
    const onPos = location.pathname.startsWith('/app/pos')
    return (
      <aside className="pwa-gate pwa-gate--update" role="alert">
        <div>
          <strong>Nova atualização disponível</strong>
          <p>
            {onPos
              ? 'Finalize a venda aberta e atualize. Não precisa desinstalar o app.'
              : 'Atualize agora para manter o PDV em dia. Não precisa desinstalar.'}
          </p>
        </div>
        <div className="pwa-gate__actions">
          <button type="button" onClick={() => void applyUpdate()}>
            Atualizar agora
          </button>
          <button type="button" className="pwa-gate__ghost" onClick={() => setNeedRefresh(false)}>
            Depois
          </button>
        </div>
      </aside>
    )
  }

  if (checking) {
    return (
      <aside className="pwa-gate pwa-gate--ready" role="status">
        <strong>Procurando atualização…</strong>
      </aside>
    )
  }

  if (installPrompt && !standalone) {
    return (
      <aside className="pwa-gate pwa-gate--install" role="dialog" aria-label="Instalar BALQO">
        <div>
          <strong>Instalar o BALQO neste aparelho</strong>
          <p>Abre como aplicativo e recebe atualizações sem desinstalar.</p>
        </div>
        <div className="pwa-gate__actions">
          <button type="button" onClick={() => void installApp()}>
            Instalar
          </button>
          <button type="button" className="pwa-gate__ghost" onClick={() => setInstallPrompt(null)}>
            Agora não
          </button>
        </div>
      </aside>
    )
  }

  if (offlineReady) {
    return (
      <aside className="pwa-gate pwa-gate--ready" role="status">
        <strong>BALQO pronto para uso neste aparelho</strong>
        <button type="button" className="pwa-gate__ghost" onClick={() => setOfflineReady(false)}>
          Ok
        </button>
      </aside>
    )
  }

  return null
}
