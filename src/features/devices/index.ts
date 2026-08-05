export { DeviceSessionProvider, useDeviceSession } from './hooks/useDeviceSession'
export { useOperationAccess } from './hooks/useOperationAccess'
export { AccessNoticeBanner } from './components/AccessNoticeBanner'
export { getLocalDeviceId, resolveLocalDeviceId } from './lib/device-id'
export {
  claimOperatorPresence,
  listLiveOperatorPresences,
  releaseOperatorPresence,
  releaseLocalDevice,
  heartbeatDevice,
  renewDeviceLease,
  updateThisDevicePrinterPath,
  renameOrgDevice,
  blockOrgDevice,
  authorizeOrgDevice,
  OperatorInUseError,
  DeviceLimitError,
  DeviceBlockedError,
  DeviceRemovedError,
} from './services/device-service'
export {
  canStartOperationalAction,
  deviceStateAllowsOperate,
  isLimitedAccessPath,
} from './services/operation-access'
export type {
  OrgDevice,
  OperatorPresence,
  DeviceStatus,
  DeviceAccessState,
  DeviceLease,
  LocalSubscriptionLease,
  OperationAccess,
  OperationDenyReason,
} from './types'
export {
  DEVICE_STATUS,
  DEVICE_STATUS_LABELS,
  DEVICE_LEASE_MS,
  DEVICE_LIMITED_AFTER_MS,
  SUBSCRIPTION_OFFLINE_MS,
} from './types'
