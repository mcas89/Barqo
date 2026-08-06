import {
  type DeviceAccessState,
  type DeviceLease,
  type LocalSubscriptionLease,
  type OperationAccess,
  type OperationDenyReason,
} from '../types'
import {
  evaluateDeviceAccess,
  evaluateSubscriptionOfflineOk,
  hoursUntil,
} from './lease-store'

const MESSAGES: Record<OperationDenyReason, string> = {
  device_not_registered: 'Este dispositivo ainda não foi autorizado. Conecte-se à internet.',
  device_blocked:
    'Este dispositivo foi bloqueado pelo administrador. Você pode consultar e sincronizar, mas não vender.',
  device_removed:
    'Este dispositivo não está mais autorizado. As operações pendentes foram preservadas.',
  device_validation_expired:
    'Este dispositivo ficou sem validação por mais de 72 horas. Conecte-se à internet para voltar a vender.',
  device_clock_invalid:
    'A data ou hora deste dispositivo parece incorreta. Conecte-se à internet para validar o acesso.',
  subscription_expired:
    'Assinatura não validada há mais de 7 dias. Conecte-se à internet para voltar a vender.',
  subscription_blocked:
    'A assinatura está bloqueada. Regularize o plano para voltar a vender.',
  operator_required: 'Desbloqueie o PDV com o PIN do operador.',
  cash_session_required: 'Abra o caixa antes de continuar.',
}

export function deviceStateAllowsOperate(state: DeviceAccessState): boolean {
  return state === 'valid' || state === 'lease_expired'
}

export function buildDeviceWarning(
  lease: DeviceLease | null,
  state: DeviceAccessState,
  nowMs = Date.now(),
): string | null {
  if (!lease) return null
  if (state === 'clock_invalid') return MESSAGES.device_clock_invalid
  if (state === 'limited' || state === 'blocked' || state === 'removed') return null

  const hoursToLimit = hoursUntil(lease.limitedAfter, nowMs)
  if (hoursToLimit != null && hoursToLimit <= 36 && state === 'lease_expired') {
    const h = Math.max(1, Math.ceil(hoursToLimit))
    return `Este dispositivo precisa se conectar à internet nas próximas ${h} hora(s) para continuar vendendo.`
  }
  if (state === 'lease_expired') {
    return 'Validação do aparelho pendente. Conecte-se à internet quando possível.'
  }
  return null
}

export function buildSubscriptionWarning(
  lease: LocalSubscriptionLease | null,
  nowMs = Date.now(),
): string | null {
  if (!lease || !lease.canOperateOnline) return null
  const hours = hoursUntil(lease.offlineAllowedUntil, nowMs)
  if (hours == null) return null
  if (hours <= 48) {
    const days = Math.max(1, Math.ceil(hours / 24))
    return `Não foi possível validar a assinatura recentemente. Conecte-se à internet nos próximos ${days} dia(s).`
  }
  return null
}

export function canStartOperationalAction(input: {
  deviceLease: DeviceLease | null
  subscriptionLease: LocalSubscriptionLease | null
  /** Se true, cobertura online da assinatura permite operar. */
  subscriptionOnlineOk?: boolean
  online?: boolean
  hasOperator?: boolean
  hasOpenCash?: boolean
  requireOperator?: boolean
  requireCash?: boolean
  nowMs?: number
}): OperationAccess {
  const nowMs = input.nowMs ?? Date.now()
  const online = input.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : true)
  const deviceState = evaluateDeviceAccess(input.deviceLease, nowMs)

  let subscriptionOk = false
  let subReason: OperationDenyReason | undefined

  if (online && input.subscriptionOnlineOk != null) {
    subscriptionOk = input.subscriptionOnlineOk
    if (!subscriptionOk) subReason = 'subscription_blocked'
  } else {
    const sub = evaluateSubscriptionOfflineOk(input.subscriptionLease, nowMs)
    subscriptionOk = sub.ok
    subReason = sub.reason
  }

  const warning =
    buildDeviceWarning(input.deviceLease, deviceState, nowMs) ||
    buildSubscriptionWarning(input.subscriptionLease, nowMs)

  const base = {
    deviceState,
    subscriptionOk,
    warning,
  }

  if (!input.deviceLease && !online) {
    return {
      ...base,
      allowed: false,
      reason: 'device_not_registered',
      message: MESSAGES.device_not_registered,
    }
  }

  if (deviceState === 'blocked') {
    return {
      ...base,
      allowed: false,
      reason: 'device_blocked',
      message: MESSAGES.device_blocked,
    }
  }
  if (deviceState === 'removed') {
    return {
      ...base,
      allowed: false,
      reason: 'device_removed',
      message: MESSAGES.device_removed,
    }
  }
  if (deviceState === 'clock_invalid') {
    return {
      ...base,
      allowed: false,
      reason: 'device_clock_invalid',
      message: MESSAGES.device_clock_invalid,
    }
  }
  if (deviceState === 'limited') {
    return {
      ...base,
      allowed: false,
      reason: 'device_validation_expired',
      message: MESSAGES.device_validation_expired,
    }
  }

  if (!subscriptionOk) {
    return {
      ...base,
      allowed: false,
      reason: subReason ?? 'subscription_expired',
      message: MESSAGES[subReason ?? 'subscription_expired'],
    }
  }

  if (input.requireOperator !== false && input.hasOperator === false) {
    return {
      ...base,
      allowed: false,
      reason: 'operator_required',
      message: MESSAGES.operator_required,
    }
  }

  if (input.requireCash && !input.hasOpenCash) {
    return {
      ...base,
      allowed: false,
      reason: 'cash_session_required',
      message: MESSAGES.cash_session_required,
    }
  }

  return {
    ...base,
    allowed: true,
  }
}

export function isLimitedAccessPath(pathname: string): boolean {
  if (!pathname.startsWith('/app')) return false
  // Assinatura/dispositivo limitado: consulta e sync liberados; escritas operacionais não.
  return !isOperationalWritePath(pathname)
}

export function isOperationalWritePath(pathname: string): boolean {
  if (pathname.startsWith('/app/pos')) return true
  if (pathname.startsWith('/app/inventory')) return true
  if (pathname.startsWith('/app/receivables')) return true
  if (pathname.startsWith('/app/sales')) return true
  if (pathname.startsWith('/app/team')) return true
  if (pathname.startsWith('/app/suppliers')) return true
  return false
}
