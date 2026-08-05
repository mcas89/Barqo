import { BrowserRouter } from 'react-router-dom'
import { PwaGate } from '../shared/components/PwaGate'
import { AppProviders } from './providers'
import { AppRouter } from './router'
import { SplashGate } from './SplashGate'

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <PwaGate />
        <SplashGate>
          <AppRouter />
        </SplashGate>
      </AppProviders>
    </BrowserRouter>
  )
}
