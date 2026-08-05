import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './providers'
import { AppRouter } from './router'
import { SplashGate } from './SplashGate'

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <SplashGate>
          <AppRouter />
        </SplashGate>
      </AppProviders>
    </BrowserRouter>
  )
}
