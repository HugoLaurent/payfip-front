import { useEffect, useState } from 'react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { PrimaryButton, SecondaryButton, StatusBadge, TextInput } from '@/components/ui'

interface AregieMailApiKeyStatus {
  configured: boolean
  last4: string | null
  updatedAt: string | null
}

/**
 * Statut + saisie d'une clé API AREGIE Mail — utilisé pour la clé par
 * défaut (page Emails) et pour la clé propre à un service (page Services,
 * voir svc-mail/settings_controller.ts pour les deux endpoints). La clé
 * n'est jamais réaffichée en clair après coup, seulement ses 4 derniers
 * caractères.
 */
export function AregieMailKeyControl({ serviceId }: { serviceId?: number }) {
  const { staffToken } = useStaffAuth()
  const { showToast } = useToast()
  const [status, setStatus] = useState<AregieMailApiKeyStatus | null>(null)
  const [editing, setEditing] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const path = serviceId ? `/staff/services/${serviceId}/aregie-mail-key` : '/staff/settings/aregie-mail'

  async function loadStatus() {
    const result = await apiCall<{ data: AregieMailApiKeyStatus }>('GET', path, { staffToken })
    if (result.ok) setStatus(result.data.data)
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffToken, serviceId])

  async function saveApiKey() {
    if (!apiKey.trim()) return
    setSaving(true)
    const result = await apiCall('PUT', path, { staffToken, body: { apiKey: apiKey.trim() } })
    setSaving(false)
    if (!result.ok) {
      showToast('error', 'Échec', "Impossible d'enregistrer la clé API.")
      return
    }
    showToast('success', 'Clé API enregistrée', 'Les prochains envois utiliseront cette clé.')
    setApiKey('')
    setEditing(false)
    await loadStatus()
  }

  return (
    <div>
      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          {status?.configured ? (
            <StatusBadge label={`Configurée · se termine par ${status.last4}`} className="bg-emerald-50 text-emerald-700" />
          ) : (
            <StatusBadge label="Non configurée" className="bg-amber-50 text-amber-700" />
          )}
          <SecondaryButton type="button" onClick={() => setEditing(true)} className="px-3.5 py-1.5 text-xs">
            {status?.configured ? 'Changer la clé' : 'Saisir la clé'}
          </SecondaryButton>
        </div>
      )}

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            type="text"
            placeholder="sk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="max-w-xs"
            autoFocus
          />
          <PrimaryButton type="button" onClick={saveApiKey} disabled={saving || !apiKey.trim()} className="px-4 py-1.5 text-xs">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing(false)
              setApiKey('')
            }}
            className="px-3.5 py-1.5 text-xs"
          >
            Annuler
          </SecondaryButton>
        </div>
      )}
    </div>
  )
}
