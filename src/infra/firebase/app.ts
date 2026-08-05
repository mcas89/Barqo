import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getApps } from 'firebase/app'

/**
 * Firebase usa VITE_FIREBASE_* do `.env` (dev) ou `.env.production` (build/Vercel).
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID,
  )
}

let app: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null
  }

  if (app) return app

  const existing = getApps()[0]
  if (existing) {
    app = existing
    return app
  }

  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })

  return app
}
