import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { apiCall, apiUpload, GATEWAY_URL } from '@/lib/api'
import { TariffsManager } from '@/components/org/TariffsManager'
import { EventsManager } from '@/components/org/EventsManager'
import { OpeningScheduleManager } from '@/components/org/OpeningScheduleManager'
import { Card, DangerButton, LoadError, Modal, SecondaryButton, StatusBadge, Textarea } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { ServiceRow } from '@/lib/types'

export function ServiceAdmin() {
  const { auth } = useAuth()
  const { showToast } = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Clic depuis la liste : l'objet est déjà en mémoire (state du router).
  // Lien direct / rechargement de page : on va le chercher.
  const [service, setService] = useState<ServiceRow | null>(
    (location.state as { service?: ServiceRow } | null)?.service ?? null
  )
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(service === null)

  useEffect(() => {
    if (service && String(service.id) === id) return
    setService(null)
    setLoadFailed(false)
    apiCall<{ data: ServiceRow }>('GET', `/auth/services/${id}`, { token: auth.token }).then(
      (result) => {
        if (result.ok) setService(result.data.data)
        else setLoadFailed(true)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadKey])

  const isAdmin = auth.role === 'admin'
  const canToggle =
    isAdmin || auth.services.find((s) => s.id === Number(id))?.permissions?.canToggleService === true
  const [cacheBust, setCacheBust] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverCacheBust, setCoverCacheBust] = useState(0)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [deletingCover, setDeletingCover] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [closeMessageInput, setCloseMessageInput] = useState('')
  const [closedMessageInput, setClosedMessageInput] = useState('')
  const [savingClosedMessage, setSavingClosedMessage] = useState(false)
  const [closedMessageError, setClosedMessageError] = useState<string | null>(null)
  const [tab, setTab] = useState<'tariffs' | 'events' | 'settings'>('tariffs')

  useEffect(() => {
    setClosedMessageInput(service?.closedMessage ?? '')
    setClosedMessageError(null)
  }, [service?.closedMessage])

  async function setServiceStatus(status: 'active' | 'archived', closedMessage?: string) {
    if (!service) return
    setTogglingStatus(true)
    const body: { status: 'active' | 'archived'; closedMessage?: string | null } = { status }
    if (status === 'archived') body.closedMessage = closedMessage?.trim() || null
    const result = await apiCall<{ data: { id: number; name: string; status: string; closedMessage: string | null } }>(
      'PATCH',
      `/auth/services/${service.id}`,
      { token: auth.token, body }
    )
    setTogglingStatus(false)
    setShowCloseConfirm(false)
    if (result.ok) {
      setService((prev) =>
        prev ? { ...prev, status, closedMessage: result.data.data.closedMessage } : prev
      )
      showToast('success', status === 'archived' ? 'Service fermé' : 'Service réactivé', service.name)
    } else {
      showToast('error', 'Échec', "Impossible de modifier le statut du service.")
    }
  }

  async function handleSaveClosedMessage() {
    if (!service) return
    const trimmed = closedMessageInput.trim()
    if (trimmed === (service.closedMessage ?? '')) return

    setSavingClosedMessage(true)
    setClosedMessageError(null)

    const result = await apiCall<{ data: { closedMessage: string | null } }>(
      'PATCH',
      `/auth/services/${service.id}`,
      { token: auth.token, body: { closedMessage: trimmed || null } }
    )

    setSavingClosedMessage(false)

    if (!result.ok) {
      setClosedMessageError('Échec de la mise à jour du message.')
      showToast('error', 'Échec', 'Impossible de mettre à jour le message.')
      return
    }

    setService((prev) => (prev ? { ...prev, closedMessage: result.data.data.closedMessage } : prev))
    showToast('success', 'Message mis à jour', service.name)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !service) return

    setUploading(true)
    setError(null)

    const result = await apiUpload(`/auth/services/${service.id}/logo`, file, auth.token)

    setUploading(false)
    e.target.value = ''

    if (!result.ok) {
      setError("Échec de l'envoi du logo.")
      showToast('error', 'Échec', "Impossible d'envoyer le logo.")
      return
    }

    setService((prev) => (prev ? { ...prev, hasLogo: true } : prev))
    setCacheBust(Date.now())
    showToast('success', 'Logo mis à jour', service.name)
  }

  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !service) return

    setUploadingCover(true)
    setCoverError(null)

    const result = await apiUpload(`/auth/services/${service.id}/cover`, file, auth.token, 'cover')

    setUploadingCover(false)
    e.target.value = ''

    if (!result.ok) {
      setCoverError("Échec de l'envoi de l'image de couverture.")
      showToast('error', 'Échec', "Impossible d'envoyer l'image de couverture.")
      return
    }

    setService((prev) => (prev ? { ...prev, hasCoverImage: true } : prev))
    setCoverCacheBust(Date.now())
    showToast('success', 'Couverture mise à jour', service.name)
  }

  async function handleDeleteCover() {
    if (!service) return

    setDeletingCover(true)
    setCoverError(null)

    const result = await apiCall('DELETE', `/auth/services/${service.id}/cover`, { token: auth.token })

    setDeletingCover(false)

    if (!result.ok) {
      setCoverError("Échec de la suppression de l'image de couverture.")
      showToast('error', 'Échec', "Impossible de supprimer l'image de couverture.")
      return
    }

    setService((prev) => (prev ? { ...prev, hasCoverImage: false } : prev))
    setCoverCacheBust(0)
    showToast('success', 'Couverture supprimée', service.name)
  }

  if (loadFailed) {
    return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
  }

  if (!service) {
    return showLoading ? <p className="text-sm text-gray-500">Chargement…</p> : null
  }

  const logoUrl = service.hasLogo
    ? `${GATEWAY_URL}/services/${service.id}/logo${cacheBust ? `?v=${cacheBust}` : ''}`
    : null
  const coverUrl = service.hasCoverImage
    ? `${GATEWAY_URL}/services/${service.id}/cover${coverCacheBust ? `?v=${coverCacheBust}` : ''}`
    : null
  const hasTariffsTab = service.serviceType === 'billetterie'
  const hasEventsTab = service.serviceType === 'inscription'
  const effectiveTab = tab === 'tariffs' && !hasTariffsTab && hasEventsTab ? 'events' : tab
  const showTariffs = hasTariffsTab && effectiveTab === 'tariffs'
  const showEvents = hasEventsTab && effectiveTab === 'events'
  const showSettings = (!hasTariffsTab && !hasEventsTab) || effectiveTab === 'settings'

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/services')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-aregie-blue"
      >
        <ArrowLeft size={15} />
        Services
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden squircle rounded-2xl ${
              logoUrl ? 'bg-gray-100' : 'bg-gradient-to-br from-aregie-deep to-aregie-light'
            }`}
          >
            {logoUrl && (
              <img src={logoUrl} alt={service.name} className="h-full w-full object-contain" />
            )}
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {service.name}
            </h1>
            <p className="truncate text-sm text-gray-500">
              {SERVICE_TYPE_LABELS[service.serviceType] ?? service.serviceType} · en ligne
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={SERVICE_STATUS_LABELS[service.status] ?? service.status}
            className={SERVICE_STATUS_TINTS[service.status] ?? 'bg-gray-100 text-gray-600'}
          />
          {canToggle && service.status === 'active' && (
            <DangerButton
              type="button"
              onClick={() => {
                setCloseMessageInput(service.closedMessage ?? '')
                setShowCloseConfirm(true)
              }}
              className="px-3 py-1.5"
            >
              Fermer le service
            </DangerButton>
          )}
          {canToggle && service.status === 'archived' && (
            <SecondaryButton
              type="button"
              onClick={() => setServiceStatus('active')}
              disabled={togglingStatus}
              className="px-3 py-1.5"
            >
              {togglingStatus ? 'Réactivation…' : 'Réactiver le service'}
            </SecondaryButton>
          )}
        </div>
      </div>

      {(hasTariffsTab || hasEventsTab) && (
        <div className="mb-4 flex gap-1.5">
          {hasTariffsTab && (
            <button
              type="button"
              onClick={() => setTab('tariffs')}
              className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
                effectiveTab === 'tariffs' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Tarifs
            </button>
          )}
          {hasEventsTab && (
            <button
              type="button"
              onClick={() => setTab('events')}
              className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
                effectiveTab === 'events' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Évènements
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
              effectiveTab === 'settings' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Paramètres
          </button>
        </div>
      )}

      {showTariffs && <TariffsManager auth={auth} service={service} />}
      {showEvents && <EventsManager auth={auth} service={service} />}

      {showSettings && (
        <>
      {service.serviceType === 'billetterie' && (
        <div className="mb-6">
          <OpeningScheduleManager
            auth={auth}
            service={service}
            canManage={canToggle}
            onServiceUpdate={(patch) => setService((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        </div>
      )}

      {service.status === 'archived' && canToggle && (
        <Card className="mb-6">
          <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Message affiché aux usagers
          </p>
          <p className="mt-0.5 mb-3 text-xs text-gray-400">
            Remplace le texte générique "Ce service n'est pas ouvert actuellement." tant que le
            service reste fermé.
          </p>
          <Textarea
            value={closedMessageInput}
            onChange={(e) => setClosedMessageInput(e.target.value)}
            placeholder="Ex. Fermé pour travaux jusqu'à nouvel ordre."
            rows={2}
            maxLength={300}
            className="mb-2"
          />
          <SecondaryButton
            type="button"
            onClick={handleSaveClosedMessage}
            disabled={savingClosedMessage || closedMessageInput.trim() === (service.closedMessage ?? '')}
            className="px-3 py-2"
          >
            {savingClosedMessage ? 'Enregistrement…' : 'Enregistrer'}
          </SecondaryButton>
          {closedMessageError && <p className="mt-2 text-xs text-red-600">{closedMessageError}</p>}
        </Card>
      )}

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden squircle rounded-xl bg-gray-100">
          {logoUrl ? (
            <img src={logoUrl} alt={service.name} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon size={22} className="text-gray-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">Logo du service</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        {isAdmin && (
          <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 squircle rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
            {uploading ? 'Envoi…' : 'Changer le logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
      </Card>

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden squircle rounded-xl bg-gray-100">
          {coverUrl ? (
            <img src={coverUrl} alt={service.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={22} className="text-gray-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">Image de couverture</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Affichée sur la page d'achat en ligne (parcours citoyen)
          </p>
          {coverError && <p className="mt-1 text-xs text-red-600">{coverError}</p>}
        </div>

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 squircle rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
              {uploadingCover ? 'Envoi…' : "Changer l'image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                disabled={uploadingCover}
                onChange={handleCoverFileChange}
              />
            </label>
            {coverUrl && (
              <DangerButton type="button" onClick={handleDeleteCover} disabled={deletingCover} className="px-3 py-2">
                {deletingCover ? 'Suppression…' : 'Supprimer'}
              </DangerButton>
            )}
          </div>
        )}
      </Card>
        </>
      )}

      {showCloseConfirm && (
        <Modal title="Fermer le service" onClose={() => setShowCloseConfirm(false)}>
          <p className="mb-4 text-sm text-gray-600">
            Les citoyens ne pourront plus acheter sur <strong>{service.name}</strong> tant qu'il
            reste fermé. Vous pourrez le réactiver à tout moment.
          </p>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Message affiché aux usagers (facultatif)
          </label>
          <Textarea
            value={closeMessageInput}
            onChange={(e) => setCloseMessageInput(e.target.value)}
            placeholder="Ex. Fermé pour travaux jusqu'à nouvel ordre."
            rows={2}
            maxLength={300}
            className="mb-4"
          />
          <div className="flex gap-2">
            <DangerButton
              type="button"
              onClick={() => setServiceStatus('archived', closeMessageInput)}
              disabled={togglingStatus}
              className="flex-1 justify-center py-2"
            >
              {togglingStatus ? 'Fermeture…' : 'Fermer'}
            </DangerButton>
            <SecondaryButton
              type="button"
              onClick={() => setShowCloseConfirm(false)}
              className="flex-1 justify-center"
            >
              Annuler
            </SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ServiceAdmin
