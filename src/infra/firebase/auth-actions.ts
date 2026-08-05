import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase'

export function requireAuth() {
  const auth = getFirebaseAuth()
  if (!auth) {
    throw new Error('Firebase Auth não configurado. Verifique o arquivo .env.')
  }
  return auth
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const auth = requireAuth()
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(credential.user, { displayName: displayName.trim() })
  return credential.user
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = requireAuth()
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function signOutCurrentUser(): Promise<void> {
  const auth = getFirebaseAuth()
  if (!auth) return
  await signOut(auth)
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = requireAuth()
  await sendPasswordResetEmail(auth, email.trim())
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    callback(null)
    return () => undefined
  }

  const auth = getFirebaseAuth()
  if (!auth) {
    callback(null)
    return () => undefined
  }

  return onAuthStateChanged(auth, callback)
}

export function mapAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message: string }).message)
      : ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Use Entrar com a mesma senha; se a loja não existir, o onboarding pede só o comércio.'
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um momento e tente de novo.'
    case 'auth/missing-email':
      return 'Informe o e-mail para redefinir a senha.'
    case 'auth/operation-not-allowed':
      return 'Login por e-mail/senha não está ativado no Firebase Console.'
    case 'auth/network-request-failed':
      return 'Falha de rede ao falar com o Firebase. Verifique a internet.'
    case 'invalid-argument':
      return 'Dados inválidos para o Firestore (campos vazios). Tente de novo.'
    default:
      if (message.toLowerCase().includes('unsupported field value: undefined')) {
        return 'Erro ao salvar dados (campo vazio). Atualize a página e tente novamente.'
      }
      return code
        ? `Não foi possível autenticar (${code}).`
        : 'Não foi possível autenticar. Tente novamente.'
  }
}
