import { APP_NAME, BALQO_LOGO_SRC } from '../constants'
import './SplashScreen.css'

interface SplashScreenProps {
  exiting?: boolean
}

export function SplashScreen({ exiting = false }: SplashScreenProps) {
  return (
    <div
      className={exiting ? 'splash-screen splash-screen--exit' : 'splash-screen'}
      role="status"
      aria-live="polite"
      aria-label="Carregando BALQO"
    >
      <img className="splash-screen__logo" src={BALQO_LOGO_SRC} alt={APP_NAME} />
    </div>
  )
}
