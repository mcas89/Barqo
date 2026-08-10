import { USER_ROLES, type UserRole } from '../../shared/constants'
import {
  DEFAULT_PLAN_ID,
  PLAN_FEATURES,
  planHasFeature,
  type PlanId,
} from '../billing'

export const PERMISSIONS = {
  BACK_OFFICE: 'back_office',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_CASH: 'manage_cash',
  MANAGE_CUSTOMERS: 'manage_customers',
  MANAGE_RECEIVABLES: 'manage_receivables',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  MANAGE_TEAM: 'manage_team',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BILLING: 'manage_billing',
  REMOVE_CART: 'remove_cart',
  CREATE_CUSTOMER: 'create_customer',
  CANCEL_SALE: 'cancel_sale',
  LABELS_PRINT: 'labels.print',
  GENERATE_BARCODE: 'products.generate_barcode',
  CHANGE_BARCODE: 'products.change_barcode',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export type PermissionMap = Record<PermissionKey, boolean>
export type PermissionOverrides = Partial<PermissionMap>

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.BACK_OFFICE]: 'Acessar menu inicial (além do PDV)',
  [PERMISSIONS.MANAGE_PRODUCTS]: 'Produtos',
  [PERMISSIONS.MANAGE_INVENTORY]: 'Estoque',
  [PERMISSIONS.MANAGE_CASH]: 'Caixa',
  [PERMISSIONS.MANAGE_CUSTOMERS]: 'Clientes',
  [PERMISSIONS.MANAGE_RECEIVABLES]: 'Fiado',
  [PERMISSIONS.MANAGE_SUPPLIERS]: 'Fornecedores',
  [PERMISSIONS.VIEW_REPORTS]: 'Relatórios',
  [PERMISSIONS.EXPORT_REPORTS]: 'Exportar relatórios',
  [PERMISSIONS.MANAGE_TEAM]: 'Equipe e PINs',
  [PERMISSIONS.MANAGE_SETTINGS]: 'Configurações',
  [PERMISSIONS.MANAGE_BILLING]: 'Planos e pagamento',
  [PERMISSIONS.REMOVE_CART]: 'Remover item / limpar carrinho no PDV',
  [PERMISSIONS.CREATE_CUSTOMER]: 'Cadastrar cliente no PDV',
  [PERMISSIONS.CANCEL_SALE]: 'Cancelar / devolver venda',
  [PERMISSIONS.LABELS_PRINT]: 'Imprimir etiquetas',
  [PERMISSIONS.GENERATE_BARCODE]: 'Gerar código de barras BALQO',
  [PERMISSIONS.CHANGE_BARCODE]: 'Alterar código de barras',
}

/** Permissões que o Gestão pode ajustar por funcionário. */
export const EDITABLE_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.BACK_OFFICE,
  PERMISSIONS.MANAGE_PRODUCTS,
  PERMISSIONS.MANAGE_INVENTORY,
  PERMISSIONS.MANAGE_CASH,
  PERMISSIONS.MANAGE_CUSTOMERS,
  PERMISSIONS.MANAGE_RECEIVABLES,
  PERMISSIONS.MANAGE_SUPPLIERS,
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.EXPORT_REPORTS,
  PERMISSIONS.MANAGE_TEAM,
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_BILLING,
  PERMISSIONS.REMOVE_CART,
  PERMISSIONS.CREATE_CUSTOMER,
  PERMISSIONS.CANCEL_SALE,
  PERMISSIONS.LABELS_PRINT,
  PERMISSIONS.GENERATE_BARCODE,
  PERMISSIONS.CHANGE_BARCODE,
]

const ALL_TRUE = Object.fromEntries(
  Object.values(PERMISSIONS).map((key) => [key, true]),
) as PermissionMap

const FLOOR_DEFAULTS: PermissionMap = {
  ...Object.fromEntries(Object.values(PERMISSIONS).map((key) => [key, false])),
  [PERMISSIONS.BACK_OFFICE]: false,
  [PERMISSIONS.MANAGE_PRODUCTS]: false,
  [PERMISSIONS.MANAGE_INVENTORY]: false,
  [PERMISSIONS.MANAGE_CASH]: false,
  [PERMISSIONS.MANAGE_CUSTOMERS]: false,
  [PERMISSIONS.MANAGE_RECEIVABLES]: true,
  [PERMISSIONS.MANAGE_SUPPLIERS]: false,
  [PERMISSIONS.VIEW_REPORTS]: false,
  [PERMISSIONS.EXPORT_REPORTS]: false,
  [PERMISSIONS.MANAGE_TEAM]: false,
  [PERMISSIONS.MANAGE_SETTINGS]: false,
  [PERMISSIONS.MANAGE_BILLING]: false,
  [PERMISSIONS.REMOVE_CART]: false,
  [PERMISSIONS.CREATE_CUSTOMER]: false,
  [PERMISSIONS.CANCEL_SALE]: false,
  [PERMISSIONS.LABELS_PRINT]: true,
  [PERMISSIONS.GENERATE_BARCODE]: false,
  [PERMISSIONS.CHANGE_BARCODE]: false,
} as PermissionMap

export function defaultPermissionsForRole(role: UserRole): PermissionMap {
  if (role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER) {
    return { ...ALL_TRUE }
  }
  return { ...FLOOR_DEFAULTS }
}

export function planSupportsFinePermissions(planId: PlanId = DEFAULT_PLAN_ID): boolean {
  return planHasFeature(planId, PLAN_FEATURES.FINE_PERMISSIONS)
}

export function resolvePermissions(input: {
  role: UserRole
  planId?: PlanId
  overrides?: PermissionOverrides | null
}): PermissionMap {
  const base = defaultPermissionsForRole(input.role)
  if (input.role === USER_ROLES.OWNER) return base
  const map =
    !planSupportsFinePermissions(input.planId) || !input.overrides
      ? base
      : { ...base, ...input.overrides }
  // Caixa/atendente sempre podem receber fiado no PDV.
  if (
    input.role === USER_ROLES.CASHIER ||
    input.role === USER_ROLES.ATTENDANT
  ) {
    return { ...map, [PERMISSIONS.MANAGE_RECEIVABLES]: true }
  }
  return map
}

export function hasPermission(
  permissions: PermissionMap | null | undefined,
  key: PermissionKey,
): boolean {
  return Boolean(permissions?.[key])
}

export function permissionForPath(pathname: string): PermissionKey | null {
  if (pathname.startsWith('/app/pos')) return null
  if (pathname.startsWith('/app/sync')) return null
  if (pathname.startsWith('/app/help')) return null
  if (pathname === '/app' || pathname.startsWith('/app/billing')) {
    return pathname.startsWith('/app/billing') ? PERMISSIONS.MANAGE_BILLING : PERMISSIONS.BACK_OFFICE
  }
  if (pathname.startsWith('/app/products')) return PERMISSIONS.MANAGE_PRODUCTS
  if (pathname.startsWith('/app/inventory')) return PERMISSIONS.MANAGE_INVENTORY
  if (pathname.startsWith('/app/cash')) return PERMISSIONS.MANAGE_CASH
  if (pathname.startsWith('/app/sales')) return PERMISSIONS.CANCEL_SALE
  if (pathname.startsWith('/app/customers')) return PERMISSIONS.MANAGE_CUSTOMERS
  if (pathname.startsWith('/app/receivables')) return PERMISSIONS.MANAGE_RECEIVABLES
  if (pathname.startsWith('/app/suppliers')) return PERMISSIONS.MANAGE_SUPPLIERS
  if (pathname.startsWith('/app/reports')) return PERMISSIONS.VIEW_REPORTS
  if (pathname.startsWith('/app/team')) return PERMISSIONS.MANAGE_TEAM
  if (pathname.startsWith('/app/settings')) return PERMISSIONS.MANAGE_SETTINGS
  return PERMISSIONS.BACK_OFFICE
}
