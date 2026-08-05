import { useState } from 'react'
import { updateOrganizationSettings } from '../../organizations'
import { useAuth } from '../../../shared/hooks/useAuth'
import { usePosOperator } from '../../pos/hooks/usePosOperator'
import { fileToLogoDataUrl } from '../lib/logo'
import type { OrganizationSettingsInput } from '../../organizations'

export function useSettings() {
  const { organization, user, refreshSession } = useAuth()
  const { hasPrivilegedAccess } = usePosOperator()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const canEdit = hasPrivilegedAccess

  async function save(input: OrganizationSettingsInput) {
    if (!organization) throw new Error('Nenhuma loja ativa.')
    if (!canEdit) throw new Error('Somente proprietário ou gerente pode alterar as configurações.')

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await updateOrganizationSettings(organization.id, input)
      await refreshSession()
      setMessage('Configurações salvas.')
    } catch (err) {
      const text =
        err instanceof Error ? err.message : 'Não foi possível salvar as configurações.'
      setError(text)
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function prepareLogo(file: File): Promise<string> {
    return fileToLogoDataUrl(file)
  }

  return {
    organization,
    user,
    canEdit,
    saving,
    error,
    message,
    clearFeedback: () => {
      setError(null)
      setMessage(null)
    },
    save,
    prepareLogo,
  }
}
