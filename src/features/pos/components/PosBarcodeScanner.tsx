import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatOneDReader } from '@zxing/browser'
import { X } from 'lucide-react'
import './PosBarcodeScanner.css'

interface PosBarcodeScannerProps {
  onDetect: (code: string) => void
  onClose: () => void
}

export function PosBarcodeScanner({ onDetect, onClose }: PosBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handledRef = useRef(false)
  const onDetectRef = useRef(onDetect)
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)

  onDetectRef.current = onDetect

  useEffect(() => {
    handledRef.current = false
    let cancelled = false
    let controls: { stop: () => void } | null = null
    const reader = new BrowserMultiFormatOneDReader(undefined, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 800,
    })

    async function start() {
      if (!videoRef.current) return
      try {
        controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result || handledRef.current || cancelled) return
            const text = result.getText().trim()
            if (!text) return
            handledRef.current = true
            try {
              ctrl.stop()
            } catch {
              /* ignore */
            }
            onDetectRef.current(text)
          },
        )
        if (cancelled) {
          controls?.stop()
          return
        }
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setStatus('error')
        setError(
          err instanceof Error && /Permission|NotAllowed/i.test(err.message)
            ? 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
            : 'Não foi possível abrir a câmera neste aparelho.',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      try {
        controls?.stop()
      } catch {
        /* ignore */
      }
      const stream = videoRef.current?.srcObject
      if (stream instanceof MediaStream) {
        for (const track of stream.getTracks()) track.stop()
        if (videoRef.current) videoRef.current.srcObject = null
      }
    }
  }, [])

  return (
    <div
      className="pos-barcode-scan"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-barcode-scan-title"
    >
      <button
        type="button"
        className="pos-barcode-scan__backdrop"
        aria-label="Fechar leitor"
        onClick={onClose}
      />
      <div className="pos-barcode-scan__sheet">
        <header className="pos-barcode-scan__head">
          <div>
            <h2 id="pos-barcode-scan-title">Ler código</h2>
            <p>Aponte a câmera para o código de barras</p>
          </div>
          <button
            type="button"
            className="pos-barcode-scan__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="pos-barcode-scan__viewport">
          <video
            ref={videoRef}
            className="pos-barcode-scan__video"
            muted
            playsInline
            autoPlay
          />
          <div className="pos-barcode-scan__reticle" aria-hidden />
          {status === 'starting' && (
            <p className="pos-barcode-scan__overlay-msg">Abrindo câmera…</p>
          )}
          {status === 'error' && (
            <p className="pos-barcode-scan__overlay-msg" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="pos-barcode-scan__foot">
          <button type="button" className="pos-barcode-scan__cancel" onClick={onClose}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  )
}
