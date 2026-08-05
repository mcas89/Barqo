export { TeamPage } from './pages/TeamPage'
export { USERS_FEATURE } from './feature'
export {
  listEmployees,
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  countSeatsUsed,
  filterEmployees,
} from './services/employee-service'
export { hashPin, verifyPin, validatePinFormat } from './services/pin'
export type { Employee, EmployeeInput, EmployeeRole } from './types'
export {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  isEmployeeRole,
} from './types'
export {
  PERMISSIONS,
  PERMISSION_LABELS,
  EDITABLE_PERMISSIONS,
  defaultPermissionsForRole,
  planSupportsFinePermissions,
  resolvePermissions,
  hasPermission,
  permissionForPath,
} from './permissions'
export type { PermissionKey, PermissionMap, PermissionOverrides } from './permissions'
