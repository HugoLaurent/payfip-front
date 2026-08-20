import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { apiCall, apiUpload, GATEWAY_URL } from '@/lib/api'
import { TariffsManager } from '@/components/org/TariffsManager'
import { Card, DangerButton, LoadError, Modal, PageHeader, SecondaryButton, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { AuthState, ServiceRow } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const STATUS_TINTS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-gray-100 text-gray-500',
}

export function ServiceAdmin({ auth }: { auth: AuthState }) {
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
  const [slugInput, setSlugInput] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)

  useEffect(() => {
    setSlugInput(service?.slug ?? '')
    setSlugError(null)
  }, [service?.slug])

  async function setServiceStatus(status: 'active' | 'archived') {
    if (!service) return
    setTogglingStatus(true)
    const result = await apiCall<{ data: { id: number; name: string; status: string } }>(
      'PATCH',
      `/auth/services/${service.id}`,
      { token: auth.token, body: { status } }
    )
    setTogglingStatus(false)
    setShowCloseConfirm(false)
    if (result.ok) setService((prev) => (prev ? { ...prev, status } : prev))
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
      return
    }

    setService((prev) => (prev ? { ...prev, hasLogo: true } : prev))
    setCacheBust(Date.now())
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
      return
    }

    setService((prev) => (prev ? { ...prev, hasCoverImage: true } : prev))
    setCoverCacheBust(Date.now())
  }

  async function handleSaveSlug() {
    if (!service) return
    const trimmed = slugInput.trim()
    if (trimmed === (service.slug ?? '')) return

    setSavingSlug(true)
    setSlugError(null)

    const result = await apiCall<{ data: { slug: string | null } }>(
      'PATCH',
      `/auth/services/${service.id}`,
      { token: auth.token, body: { slug: trimmed || null } }
    )

    setSavingSlug(false)

    if (!result.ok) {
      if (result.status === 409) {
        setSlugError('Ce lien est déjà utilisé par un autre service.')
      } else if (result.status === 400) {
        setSlugError('Lien invalide — lettres minuscules, chiffres et tirets uniquement.')
      } else {
        setSlugError('Échec de la mise à jour du lien.')
      }
      return
    }

    setService((prev) => (prev ? { ...prev, slug: result.data.data.slug } : prev))
  }

  async function handleDeleteCover() {
    if (!service) return

    setDeletingCover(true)
    setCoverError(null)

    const result = await apiCall('DELETE', `/auth/services/${service.id}/cover`, { token: auth.token })

    setDeletingCover(false)

    if (!result.ok) {
      setCoverError("Échec de la suppression de l'image de couverture.")
      return
    }

    setService((prev) => (prev ? { ...prev, hasCoverImage: false } : prev))
    setCoverCacheBust(0)
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

      <PageHeader
        title={service.name}
        subtitle={service.serviceType}
        action={
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TINTS[service.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {STATUS_LABELS[service.status] ?? service.status}
            </span>
            {canToggle && service.status === 'active' && (
              <DangerButton
                type="button"
                onClick={() => setShowCloseConfirm(true)}
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
        }
      />

      <Card className="mb-6">
        <p className="text-sm font-medium text-gray-700">Lien public</p>
        <p className="mt-0.5 mb-3 text-xs text-gray-400">
          L'adresse que les usagers utilisent pour accéder à ce service en ligne, sans compte.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-sm text-gray-400">
            {window.location.origin}/{service.serviceType}/
          </span>
          <TextInput
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
            placeholder="mon-service"
            disabled={!isAdmin}
            className="max-w-[240px]"
          />
          {isAdmin && (
            <SecondaryButton
              type="button"
              onClick={handleSaveSlug}
              disabled={savingSlug || slugInput.trim() === (service.slug ?? '')}
              className="px-3 py-2"
            >
              {savingSlug ? 'Enregistrement…' : 'Enregistrer'}
            </SecondaryButton>
          )}
        </div>
        {slugError && <p className="mt-2 text-xs text-red-600">{slugError}</p>}
        {!service.slug && (
          <p className="mt-2 text-xs text-amber-600">
            Sans lien public, ce service n'est pas accessible en ligne par les usagers.
          </p>
        )}
      </Card>

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
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
          <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
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
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
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
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
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

      {service.serviceType === 'billetterie' && <TariffsManager auth={auth} service={service} />}

      {showCloseConfirm && (
        <Modal title="Fermer le service" onClose={() => setShowCloseConfirm(false)}>
          <p className="mb-4 text-sm text-gray-600">
            Les citoyens ne pourront plus acheter sur <strong>{service.name}</strong> tant qu'il
            reste fermé. Vous pourrez le réactiver à tout moment.
          </p>
          <div className="flex gap-2">
            <DangerButton
              type="button"
              onClick={() => setServiceStatus('archived')}
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
