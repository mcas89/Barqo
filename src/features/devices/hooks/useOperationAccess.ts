import { useMemo } from 'react'
import { useDeviceSession } from './useDeviceSession'
import type { OperationAccess } from '../types'

/** Acesso operacional central (dispositivo + assinatura). Passe operador/caixa no options. */
export function useOperationAccess(options?: {
  hasOperator?: boolean
  hasOpenCash?: boolean
  requireCash?: boolean
  requireOperator?: boolean
}): OperationAccess {
  const { getOperationAccess } = useDeviceSession()

  return useMemo(
    () =>
      getOperationAccess({
        hasOperator: options?.hasOperator,
        hasOpenCash: options?.hasOpenCash,
        requireOperator: options?.requireOperator,
        requireCash: options?.requireCash,
      }),
    [
      getOperationAccess,
      options?.hasOperator,
      options?.hasOpenCash,
      options?.requireOperator,
      options?.requireCash,
    ],
  )
}
