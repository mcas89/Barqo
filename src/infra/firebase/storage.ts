import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp, isFirebaseConfigured } from './app'

let storage: FirebaseStorage | null = null

/** Retorna Storage ou null se Firebase ainda não estiver configurado. */
export function getFirebaseStorage(): FirebaseStorage | null {
  if (!isFirebaseConfigured()) return null

  if (!storage) {
    const app = getFirebaseApp()
    if (!app) return null
    storage = getStorage(app)
  }

  return storage
}
