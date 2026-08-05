import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseApp, isFirebaseConfigured } from './app'

let db: Firestore | null = null

/** Retorna Firestore ou null se Firebase ainda não estiver configurado. */
export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null

  if (!db) {
    const app = getFirebaseApp()
    if (!app) return null
    db = getFirestore(app)
  }

  return db
}
