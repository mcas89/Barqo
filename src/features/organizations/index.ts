export {
  getUserProfile,
  ensureUserProfile,
  getOrganization,
  getMemberRole,
  createOrganizationWithOwner,
  updateOrganizationSettings,
  healOwnerDisplayName,
  toAppUser,
  listUserOrganizations,
  findOrganizationsByOwner,
} from './services/organization-service'
export type { OrganizationSettingsInput } from './services/organization-service'

export const ORGANIZATIONS_FEATURE = 'organizations' as const
