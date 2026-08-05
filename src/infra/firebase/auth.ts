import { getAuth, type Auth } from 'firebase/auth'
import { getFirebaseApp, isFirebaseConfigured } from './app'

let auth: Auth | null = null

/** Retorna Auth ou null se Firebase ainda não estiver configurado. */
export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null

  if (!auth) {
    const app = getFirebaseApp()
    if (!app) return null
    auth = getAuth(app)
  }

  return auth
}
