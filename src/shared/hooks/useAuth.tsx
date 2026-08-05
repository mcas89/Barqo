import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from '../../infra/firebase'
import { getFirebaseAuth } from '../../infra/firebase/auth'
import {
  mapAuthError,
  sendPasswordReset,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  subscribeAuth,
} from '../../infra/firebase/auth-actions'
import {
  createOrganizationWithOwner,
  ensureUserProfile,
  getMemberRole,
  getOrganization,
  toAppUser,
} from '../../features/organizations'
import type { OrganizationSubscription } from '../../features/billing'
import { USER_ROLES, type PlanId } from '../constants'
import { pickPersonName } from '../lib/person-name'
import { releaseLocalDevice } from '../../features/devices'
import type { AppUser, Organization } from '../types'

interface AuthContextValue {
  user: AppUser | null
  organization: Organization | null
  subscription: OrganizationSubscription | null
  firebaseReady: boolean
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  clearError: () => void
  login: (email: string, password: string) => Promise<void>
  registerAccount: (input: {
    displayName: string
    email: string
    password: string
  }) => Promise<void>
  registerAndCreateOrganization: (input: {
    displayName: string
    email: string
    password: string
    organizationName: string
    document?: string
    segment?: string
    planId?: PlanId
    themeColor?: string
    logoDataUrl?: string
    ownerPin?: string
  }) => Promise<void>
  createOrganizationForCurrentUser: (input: {
    organizationName: string
    document?: string
    segment?: string
    planId?: PlanId
    themeColor?: string
    logoDataUrl?: string
    ownerPin?: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapSessionError(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  if (code === 'permission-denied') {
    return 'Sem permissão no Firestore. Confirme se o banco está em modo de teste ou com regras liberadas.'
  }

  return mapAuthError(error)
}

async function loadSubscription(
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const db = getFirestoreDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'subscriptions', organizationId))
  if (!snap.exists()) return null
  return snap.data() as OrganizationSubscription
}

async function hydrateFromFirebaseUser(firebaseUser: User): Promise<{
  user: AppUser
  organization: Organization | null
  subscription: OrganizationSubscription | null
}> {
  const profile = await ensureUserProfile({
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    displayName: pickPersonName([firebaseUser.displayName]),
  })

  const orgId = profile.activeOrganizationId
  if (!orgId) {
    const user = await toAppUser(profile, USER_ROLES.OWNER)
    return {
      user: {
        ...user,
        displayName: pickPersonName([
          firebaseUser.displayName,
          user.displayName,
        ]),
      },
      organization: null,
      subscription: null,
    }
  }

  const [organization, role, subscription] = await Promise.all([
    getOrganization(orgId),
    getMemberRole(orgId, profile.id),
    loadSubscription(orgId),
  ])

  const user = await toAppUser(profile, role ?? USER_ROLES.OWNER)
  return {
    user: {
      ...user,
      displayName: pickPersonName([
        firebaseUser.displayName,
        user.displayName,
        organization?.ownerName,
      ]),
    },
    organization,
    subscription,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebaseReady = isFirebaseConfigured()
  const [user, setUser] = useState<AppUser | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null)
  const [loading, setLoading] = useState(firebaseReady)
  const [error, setError] = useState<string | null>(null)

  const applySession = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setUser(null)
      setOrganization(null)
      setSubscription(null)
      return
    }

    const session = await hydrateFromFirebaseUser(firebaseUser)
    setUser(session.user)
    setOrganization(session.organization)
    setSubscription(session.subscription)
  }, [])

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false)
      return
    }

    const unsubscribe = subscribeAuth((firebaseUser) => {
      void (async () => {
        try {
          setLoading(true)
          await applySession(firebaseUser)
          setError(null)
        } catch (err) {
          console.error(err)
          setError(mapSessionError(err))
          setUser(null)
          setOrganization(null)
          setSubscription(null)
        } finally {
          setLoading(false)
        }
      })()
    })

    return unsubscribe
  }, [applySession, firebaseReady])

  useEffect(() => {
    if (!firebaseReady || !organization?.id) return
    const db = getFirestoreDb()
    if (!db) return
    return onSnapshot(doc(db, 'subscriptions', organization.id), (snap) => {
      if (snap.exists()) {
        setSubscription(snap.data() as OrganizationSubscription)
      }
    })
  }, [firebaseReady, organization?.id])

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setLoading(true)
      try {
        const firebaseUser = await signInWithEmail(email, password)
        await applySession(firebaseUser)
      } catch (err) {
        setError(mapSessionError(err))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const registerAccount = useCallback(
    async (input: { displayName: string; email: string; password: string }) => {
      setError(null)
      setLoading(true)
      try {
        const firebaseUser = await signUpWithEmail(
          input.email,
          input.password,
          input.displayName,
        )
        await ensureUserProfile({
          id: firebaseUser.uid,
          email: input.email.trim(),
          displayName: input.displayName.trim(),
        })
        await applySession(firebaseUser)
      } catch (err) {
        setError(mapSessionError(err))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const registerAndCreateOrganization = useCallback(
    async (input: {
      displayName: string
      email: string
      password: string
      organizationName: string
      document?: string
      segment?: string
      planId?: PlanId
      themeColor?: string
      logoDataUrl?: string
      ownerPin?: string
    }) => {
      setError(null)
      setLoading(true)
      try {
        const firebaseUser = await signUpWithEmail(
          input.email,
          input.password,
          input.displayName,
        )

        const { organization: org, profile } = await createOrganizationWithOwner({
          owner: {
            id: firebaseUser.uid,
            email: input.email.trim(),
            displayName: input.displayName.trim(),
          },
          name: input.organizationName,
          document: input.document,
          segment: input.segment,
          planId: input.planId,
          themeColor: input.themeColor,
          logoDataUrl: input.logoDataUrl,
          ownerPin: input.ownerPin,
        })

        setUser(await toAppUser(profile, USER_ROLES.OWNER))
        setOrganization(org)
        setSubscription(await loadSubscription(org.id))
      } catch (err) {
        setError(mapSessionError(err))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const createOrganizationForCurrentUser = useCallback(
    async (input: {
      organizationName: string
      document?: string
      segment?: string
      planId?: PlanId
      themeColor?: string
      logoDataUrl?: string
      ownerPin?: string
    }) => {
      setError(null)
      setLoading(true)
      try {
        const auth = getFirebaseAuth()
        const current = auth?.currentUser
        if (!current || !user) {
          throw new Error('Faça login antes de criar o comércio.')
        }

        const { organization: org, profile } = await createOrganizationWithOwner({
          owner: {
            id: current.uid,
            email: user.email,
            displayName: pickPersonName([user.displayName]),
          },
          name: input.organizationName,
          document: input.document,
          segment: input.segment,
          planId: input.planId,
          themeColor: input.themeColor,
          logoDataUrl: input.logoDataUrl,
          ownerPin: input.ownerPin,
        })

        setUser(await toAppUser(profile, USER_ROLES.OWNER))
        setOrganization(org)
        setSubscription(await loadSubscription(org.id))
      } catch (err) {
        setError(mapSessionError(err))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  const logout = useCallback(async () => {
    setError(null)
    if (organization) {
      await releaseLocalDevice(organization.id).catch(() => undefined)
    }
    await signOutCurrentUser()
    setUser(null)
    setOrganization(null)
    setSubscription(null)
  }, [organization])

  const refreshSession = useCallback(async () => {
    const current = getFirebaseAuth()?.currentUser ?? null
    await applySession(current)
  }, [applySession])

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null)
    try {
      await sendPasswordReset(email)
    } catch (err) {
      setError(mapSessionError(err))
      throw err
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organization,
      subscription,
      firebaseReady,
      isAuthenticated: Boolean(user),
      loading,
      error,
      clearError: () => setError(null),
      login,
      registerAccount,
      registerAndCreateOrganization,
      createOrganizationForCurrentUser,
      logout,
      refreshSession,
      requestPasswordReset,
    }),
    [
      user,
      organization,
      subscription,
      firebaseReady,
      loading,
      error,
      login,
      registerAccount,
      registerAndCreateOrganization,
      createOrganizationForCurrentUser,
      logout,
      refreshSession,
      requestPasswordReset,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
