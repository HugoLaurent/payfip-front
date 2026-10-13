import { useEffect, useState } from 'react'
import { apiCall } from '@/lib/api'
import { useToast } from '@/lib/useToast'
import { Card, SecondaryButton, TextInput } from '@/components/ui'
import type { AuthState, ServiceDocumentSettings, ServiceRow } from '@/lib/types'

const EMAIL_RE = /^\S+@\S+\.\S+$/

function parseEmailList(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

// Réglage de service (Paramètres) : la boîte de l'agent qui REÇOIT les pièces
// justificatives des inscriptions, et ses copies (CC). Valable pour tous les
// évènements du service. Les pièces sont relayées par email depuis le domaine
// du service, PayFiP n'en conserve aucune. Sans adresse, les inscriptions à un
// évènement qui demande des pièces sont indisponibles côté citoyen.
export function DocumentsRecipientCard({
  auth,
  service,
  canManage,
}: {
  auth: AuthState
  service: ServiceRow
  canManage: boolean
}) {
  const { showToast } = useToast()
  const [saved, setSaved] = useState<ServiceDocumentSettings | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [cc, setCc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSaved(null)
    setLoadFailed(false)
    apiCall<{ data: ServiceDocumentSettings }>('GET', `/inscription/services/${service.id}/settings`, {
      token: auth.token,
    }).then((result) => {
      if (!result.ok) {
        setLoadFailed(true)
        return
      }
      const settings = result.data.data
      setSaved(settings)
      setEmail(settings.documentContactEmail ?? '')
      setCc(settings.documentContactCc.join(', '))
    })
  }, [service.id, auth.token])

  const ccList = parseEmailList(cc)
  const emailTrimmed = email.trim()
  const emailInvalid = emailTrimmed !== '' && !EMAIL_RE.test(emailTrimmed)
  const ccInvalid = ccList.length > 4 || ccList.some((entry) => !EMAIL_RE.test(entry))
  const unchanged =
    saved !== null &&
    emailTrimmed.toLowerCase() === (saved.documentContactEmail ?? '') &&
    ccList.map((entry) => entry.toLowerCase()).join(',') === saved.documentContactCc.join(',')

  async function handleSave() {
    if (!saved || emailInvalid || ccInvalid) return
    setSaving(true)
    setError(null)
    const result = await apiCall<{ data: ServiceDocumentSettings }>('PUT', `/inscription/services/${service.id}/settings`, {
      token: auth.token,
      body: { documentContactEmail: emailTrimmed || null, documentContactCc: ccList },
    })
    setSaving(false)

    if (!result.ok) {
      setError("Échec de l'enregistrement.")
      showToast('error', 'Échec', "Impossible d'enregistrer l'adresse de réception.")
      return
    }
    const settings = result.data.data
    setSaved(settings)
    setEmail(settings.documentContactEmail ?? '')
    setCc(settings.documentContactCc.join(', '))
    showToast('success', 'Adresse enregistrée', service.name)
  }

  return (
    <Card>
      <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
        Réception des pièces justificatives
      </p>
      <p className="mt-0.5 mb-3 text-xs text-gray-400">
        Quand un évènement demande des pièces, le citoyen les dépose dans le formulaire d'inscription : elles vous sont
        transmises par email, en pièces jointes, depuis le domaine du service. PayFiP n'en conserve aucune : une fois reçues,
        leur conservation dans votre messagerie relève de votre organisme (pensez à les supprimer après vérification).
      </p>

      {loadFailed && <p className="text-xs text-red-600">Impossible de charger ce réglage.</p>}

      {!loadFailed && saved && !saved.documentContactEmail && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Aucune adresse renseignée : les inscriptions à un évènement qui demande des pièces sont indisponibles.
        </p>
      )}

      {!loadFailed && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-gray-500">Adresse de réception</label>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="inscriptions@ma-commune.fr"
              disabled={!canManage || saved === null}
              className="w-full"
            />
            {emailInvalid && <p className="mt-1 text-xs text-red-600">Adresse invalide.</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-gray-500">
              Copie (CC) <span className="font-normal text-gray-400">— facultatif, 4 adresses maximum</span>
            </label>
            <TextInput
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="second.agent@ma-commune.fr, direction@ma-commune.fr"
              disabled={!canManage || saved === null}
              className="w-full"
            />
            {ccInvalid && (
              <p className="mt-1 text-xs text-red-600">Une adresse en copie est invalide (4 maximum, séparées par des virgules).</p>
            )}
          </div>

          {canManage ? (
            <SecondaryButton
              type="button"
              onClick={handleSave}
              disabled={saving || saved === null || unchanged || emailInvalid || ccInvalid}
              className="px-3 py-2"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </SecondaryButton>
          ) : (
            <p className="text-xs text-gray-400">Seul un administrateur peut modifier ce réglage.</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  )
}
