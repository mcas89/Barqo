export { DeviceSessionProvider, useDeviceSession } from './hooks/useDeviceSession'
export { getLocalDeviceId } from './lib/device-id'
export {
  claimOperatorPresence,
  listLiveOperatorPresences,
  releaseOperatorPresence,
  releaseLocalDevice,
  heartbeatDevice,
  OperatorInUseError,
  DeviceLimitError,
} from './services/device-service'
export type { OrgDevice, OperatorPresence } from './types'
