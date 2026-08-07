import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { getFirestoreDb } from '../../../infra/firebase'
import { createId } from '../../../shared/lib/ids'
import { nowIso } from '../../../shared/lib/dates'
import { omitUndefined } from '../../../shared/lib/firestore'
import {
  DEFAULT_THEME_COLOR,
  resolveThemeColor,
  USER_ROLES,
  type PlanId,
  type UserRole,
} from '../../../shared/constants'
import { createDefaultSubscription, DEFAULT_PLAN_ID } from '../../billing'
import { hashPin, validatePinFormat } from '../../users/services/pin'
import { pickPersonName } from '../../../shared/lib/person-name'
import type { AppUser, Organization, OrganizationId, UserId } from '../../../shared/types'

function requireDb() {
  const db = getFirestoreDb()
  if (!db) {
    throw new Error('Firestore não configurado. Verifique o arquivo .env.')
  }
  return db
}

export interface UserProfileDoc {
  id: UserId
  email: string
  displayName: string
  activeOrganizationId: OrganizationId | null
  organizationIds: OrganizationId[]
  createdAt: string
}

export interface MemberDoc {
  userId: UserId
  email: string
  displayName: string
  role: UserRole
  createdAt: string
  /** PIN do PDV (dono/gerente com login). */
  pinHash?: string
  pinUpdatedAt?: string
}

export interface CreateOrganizationInput {
  owner: {
    id: UserId
    email: string
    displayName: string
  }
  name: string
  document?: string
  segment?: string
  planId?: PlanId
  themeColor?: string
  logoDataUrl?: string
  ownerPin?: string
}

export async function getUserProfile(userId: UserId): Promise<UserProfileDoc | null> {
  const db = requireDb()
  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) return null
  return snap.data() as UserProfileDoc
}

export async function ensureUserProfile(input: {
  id: UserId
  email: string
  displayName: string
}): Promise<UserProfileDoc> {
  const existing = await getUserProfile(input.id)
  const nextName = pickPersonName([input.displayName, existing?.displayName])

  if (existing) {
    if (nextName !== existing.displayName && nextName !== 'Proprietário') {
      await updateDoc(doc(requireDb(), 'users', input.id), { displayName: nextName })
      return { ...existing, displayName: nextName }
    }
    return { ...existing, displayName: nextName }
  }

  const profile: UserProfileDoc = {
    id: input.id,
    email: input.email,
    displayName: nextName,
    activeOrganizationId: null,
    organizationIds: [],
    createdAt: nowIso(),
  }

  const db = requireDb()
  await setDoc(doc(db, 'users', input.id), profile)
  return profile
}

export async function healOwnerDisplayName(input: {
  organizationId: OrganizationId
  ownerId: UserId
  displayName: string
}): Promise<void> {
  const name = pickPersonName([input.displayName])
  if (name === 'Proprietário') return

  const db = requireDb()
  await Promise.all([
    updateDoc(doc(db, 'users', input.ownerId), { displayName: name }).catch(() => undefined),
    updateDoc(doc(db, 'organizations', input.organizationId, 'members', input.ownerId), {
      displayName: name,
    }).catch(() => undefined),
    updateDoc(doc(db, 'organizations', input.organizationId), { ownerName: name }).catch(
      () => undefined,
    ),
  ])
}

function mapOrganization(id: string, data: Record<string, unknown>): Organization {
  const organization: Organization = {
    id,
    name: data.name as string,
    createdAt: data.createdAt as string,
  }

  const document = data.document as string | undefined
  const segment = data.segment as string | undefined
  const phone = data.phone as string | undefined
  const address = data.address as string | undefined
  const planId = data.planId as PlanId | undefined
  const themeColor = resolveThemeColor(data.themeColor as string | undefined)
  const logoDataUrl = data.logoDataUrl as string | undefined
  const whatsapp = data.whatsapp as string | undefined
  const ownerId = data.ownerId as string | undefined
  const ownerEmail = data.ownerEmail as string | undefined
  const ownerName = data.ownerName as string | undefined
  const updatedAt = data.updatedAt as string | undefined
  const printerPath = data.printerPath as string | undefined
  const receiptPaperWidth = data.receiptPaperWidth as Organization['receiptPaperWidth']

  if (document) organization.document = document
  if (segment) organization.segment = segment
  if (phone) organization.phone = phone
  if (address) organization.address = address
  if (planId) organization.planId = planId
  organization.themeColor = themeColor
  if (logoDataUrl) organization.logoDataUrl = logoDataUrl
  if (whatsapp) organization.whatsapp = whatsapp
  organization.printReceiptOnSale = Boolean(data.printReceiptOnSale)
  organization.sendReceiptOnSale = Boolean(data.sendReceiptOnSale)
  organization.offerWhatsappReceiptOnSale = Boolean(data.offerWhatsappReceiptOnSale)
  if (printerPath) organization.printerPath = printerPath
  if (receiptPaperWidth === '58mm' || receiptPaperWidth === '80mm') {
    organization.receiptPaperWidth = receiptPaperWidth
  }
  if (ownerId) organization.ownerId = ownerId
  if (ownerEmail) organization.ownerEmail = ownerEmail
  if (ownerName) organization.ownerName = ownerName
  if (updatedAt) organization.updatedAt = updatedAt

  return organization
}

export async function getOrganization(orgId: OrganizationId): Promise<Organization | null> {
  const db = requireDb()
  const snap = await getDoc(doc(db, 'organizations', orgId))
  if (!snap.exists()) return null
  return mapOrganization(orgId, snap.data())
}

export interface OrganizationSettingsInput {
  name: string
  document?: string
  segment?: string
  phone?: string
  address?: string
  themeColor?: string
  logoDataUrl?: string | null
  whatsapp?: string
  printReceiptOnSale?: boolean
  sendReceiptOnSale?: boolean
  offerWhatsappReceiptOnSale?: boolean
  printerPath?: string
  receiptPaperWidth?: '58mm' | '80mm'
}

export async function updateOrganizationSettings(
  orgId: OrganizationId,
  input: OrganizationSettingsInput,
): Promise<Organization> {
  const existing = await getOrganization(orgId)
  if (!existing) throw new Error('Comércio não encontrado.')

  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome do comércio.')

  const themeColor = (input.themeColor || DEFAULT_THEME_COLOR).trim()
  if (!/^#([0-9a-fA-F]{6})$/.test(themeColor)) {
    throw new Error('Cor inválida. Use o formato #RRGGBB.')
  }

  const updatedAt = nowIso()
  const next: Organization = {
    ...existing,
    name,
    themeColor,
    updatedAt,
  }

  const document = input.document?.trim()
  const segment = input.segment?.trim()
  const phone = input.phone?.trim()
  const address = input.address?.trim()
  const whatsapp = input.whatsapp?.replace(/\D/g, '')

  if (document) next.document = document
  else delete next.document
  if (segment) next.segment = segment
  else delete next.segment
  if (phone) next.phone = phone
  else delete next.phone
  if (address) next.address = address
  else delete next.address
  if (whatsapp) next.whatsapp = whatsapp
  else delete next.whatsapp

  if (input.printReceiptOnSale !== undefined) {
    next.printReceiptOnSale = input.printReceiptOnSale
  }
  if (input.sendReceiptOnSale !== undefined) {
    next.sendReceiptOnSale = input.sendReceiptOnSale
  }
  if (input.offerWhatsappReceiptOnSale !== undefined) {
    next.offerWhatsappReceiptOnSale = input.offerWhatsappReceiptOnSale
  }
  if (input.receiptPaperWidth) {
    next.receiptPaperWidth = input.receiptPaperWidth
  }
  const printerPath = input.printerPath?.trim()
  if (input.printerPath !== undefined) {
    if (printerPath) next.printerPath = printerPath
    else delete next.printerPath
  }

  if (input.logoDataUrl === null) {
    delete next.logoDataUrl
  } else if (input.logoDataUrl) {
    next.logoDataUrl = input.logoDataUrl
  }

  await updateDoc(
    doc(requireDb(), 'organizations', orgId),
    omitUndefined({
      name: next.name,
      document: next.document ?? null,
      segment: next.segment ?? null,
      phone: next.phone ?? null,
      address: next.address ?? null,
      themeColor: next.themeColor,
      logoDataUrl: next.logoDataUrl ?? null,
      whatsapp: next.whatsapp ?? null,
      printReceiptOnSale: next.printReceiptOnSale ?? false,
      sendReceiptOnSale: next.sendReceiptOnSale ?? false,
      offerWhatsappReceiptOnSale: next.offerWhatsappReceiptOnSale ?? false,
      printerPath: next.printerPath ?? null,
      receiptPaperWidth: next.receiptPaperWidth ?? '58mm',
      updatedAt,
    }),
  )

  return next
}

export async function getMemberRole(
  orgId: OrganizationId,
  userId: UserId,
): Promise<UserRole | null> {
  const db = requireDb()
  const snap = await getDoc(doc(db, 'organizations', orgId, 'members', userId))
  if (!snap.exists()) return null
  return (snap.data().role as UserRole) ?? null
}

export async function createOrganizationWithOwner(
  input: CreateOrganizationInput,
): Promise<{ organization: Organization; profile: UserProfileDoc }> {
  const db = requireDb()
  const orgId = createId('org')
  const createdAt = nowIso()
  const planId = input.planId ?? DEFAULT_PLAN_ID

  const themeColor = resolveThemeColor(input.themeColor || DEFAULT_THEME_COLOR)
  const ownerName = pickPersonName([input.owner.displayName])

  const organization: Organization = {
    id: orgId,
    name: input.name.trim(),
    planId,
    themeColor,
    ownerId: input.owner.id,
    ownerEmail: input.owner.email,
    ownerName,
    createdAt,
  }

  const document = input.document?.trim()
  const segment = input.segment?.trim()
  const logoDataUrl = input.logoDataUrl?.trim()
  if (document) organization.document = document
  if (segment) organization.segment = segment
  if (logoDataUrl) organization.logoDataUrl = logoDataUrl

  const member: MemberDoc = {
    userId: input.owner.id,
    email: input.owner.email,
    displayName: ownerName,
    role: USER_ROLES.OWNER,
    createdAt,
  }

  const ownerPin = input.ownerPin?.trim()
  if (ownerPin) {
    const pinError = validatePinFormat(ownerPin)
    if (pinError) throw new Error(pinError)
    member.pinHash = await hashPin(orgId, ownerPin)
    member.pinUpdatedAt = createdAt
  }

  const subscription = createDefaultSubscription(orgId, planId)

  const profile = await ensureUserProfile(input.owner)
  const nextProfile: UserProfileDoc = {
    ...profile,
    displayName: ownerName,
    organizationIds: Array.from(new Set([...profile.organizationIds, orgId])),
    activeOrganizationId: orgId,
  }

  await setDoc(
    doc(db, 'organizations', orgId),
    omitUndefined({
      ...organization,
    }),
  )
  await setDoc(doc(db, 'organizations', orgId, 'members', input.owner.id), member)
  await setDoc(doc(db, 'subscriptions', orgId), omitUndefined({ ...subscription }))
  await setDoc(doc(db, 'users', input.owner.id), nextProfile)

  return { organization, profile: nextProfile }
}

export async function toAppUser(
  profile: UserProfileDoc,
  role: UserRole = USER_ROLES.OWNER,
): Promise<AppUser> {
  return {
    id: profile.id,
    email: profile.email,
    displayName: pickPersonName([profile.displayName]),
    organizationIds: profile.organizationIds,
    role,
  }
}

/** Lista orgs onde o usuário é membro (via campo organizationIds do perfil). */
export async function listUserOrganizations(
  organizationIds: OrganizationId[],
): Promise<Organization[]> {
  if (organizationIds.length === 0) return []

  const results = await Promise.all(organizationIds.map((id) => getOrganization(id)))
  return results.filter((org): org is Organization => Boolean(org))
}

export async function findOrganizationsByOwner(ownerId: UserId): Promise<Organization[]> {
  const db = requireDb()
  const q = query(collection(db, 'organizations'), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  return snap.docs.map((item) => mapOrganization(item.id, item.data()))
}
