import { useCallback, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useDeviceSession } from '../../devices'
import type { Sale } from '../../pos/types'
import { reprintSaleReceipt } from '../delivery'
import { resolveReceiptSettings } from '../settings'

export function useReprintSale() {
  const { organization } = useAuth()
  const { devices, deviceId } = useDeviceSession()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reprint = useCallback(
    async (sale: Sale) => {
      if (!organization) {
        setError('Nenhuma loja ativa.')
        return
      }

      setBusyId(sale.id)
      setError(null)
      try {
        const devicePrinterPath = devices.find((device) => device.id === deviceId)?.printerPath
        const settings = resolveReceiptSettings({
          organization,
          devicePrinterPath,
        })
        const result = await reprintSaleReceipt({ sale, organization, settings })
        if (result.status === 'failed') {
          setError(result.message || 'Não foi possível imprimir a 2ª via.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível imprimir a 2ª via.')
      } finally {
        setBusyId(null)
      }
    },
    [organization, devices, deviceId],
  )

  return { reprint, busyId, error, clearError: () => setError(null) }
}
