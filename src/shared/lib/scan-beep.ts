let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx()
  }
  return audioCtx
}

function tone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume = 0.09,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(volume, startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

/** Bip de leitor: sucesso (agudo) ou produto não encontrado (grave). */
export function playScanBeep(kind: 'ok' | 'error' = 'ok') {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    if (kind === 'ok') {
      tone(ctx, 1800, now, 0.07)
      tone(ctx, 2200, now + 0.08, 0.08)
      return
    }
    tone(ctx, 240, now, 0.18, 0.1)
    tone(ctx, 180, now + 0.14, 0.16, 0.08)
  } catch {
    // sem áudio disponível (autoplay / contexto)
  }
}
