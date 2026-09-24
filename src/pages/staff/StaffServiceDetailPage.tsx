import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarOff, ImageIcon, Plus, Trash2 } from 'lucide-react'
import { apiCall, apiUpload, GATEWAY_URL } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { Card, DangerButton, LoadError, PrimaryButton, SecondaryButton, StatusBadge, TextInput } from '@/components/ui'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import { StaffServiceTariffs } from '@/components/staff/StaffServiceTariffs'
import { StaffServiceFormations } from '@/components/staff/StaffServiceFormations'
import type { ServiceClosure, ServiceRow } from '@/lib/types'

// Fiche service staff — remplace la modale (max-w-md) qui entassait
// logo/couverture/tarifs-ou-évènements/fermetures : gérer les évènements
// d'un service d'inscription y méritait un vrai espace (mêmes composants
// StaffServiceFormations/StaffServiceTariffs, réutilisés tels quels),
// comme la fiche service côté organisme (ServiceAdmin.tsx). Onglets
// seulement si le service a des tarifs ou des évènements à gérer — sinon
// (ex. facturation) Paramètres reste l'unique contenu.
export function StaffServiceDetailPage() {
  const { id: orgId, serviceId } = useParams<{ id: string; serviceId: string }>()
  const { staffToken } = useStaffAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [service, setService] = useState<ServiceRow | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(service === null && !loadFailed)

  useEffect(() => {
    setService(null)
    setLoadFailed(false)
    apiCall<{ data: ServiceRow }>('GET', `/staff/services/${serviceId}`, { staffToken }).then((result) => {
      if (result.ok) setService(result.data.data)
      else setLoadFailed(true)
    })
  }, [staffToken, serviceId, reloadKey])

  const [cacheBust, setCacheBust] = useState(0)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [deletingCover, setDeletingCover] = useState(false)
  const [showAddClosure, setShowAddClosure] = useState(false)
  const [closureLabel, setClosureLabel] = useState('')
  const [closureStart, setClosureStart] = useState('')
  const [closureEnd, setClosureEnd] = useState('')
  const [creatingClosure, setCreatingClosure] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)

  const hasTariffsTab = service?.serviceType === 'billetterie'
  const hasEventsTab = service?.serviceType === 'inscription'
  const [tab, setTab] = useState<'main' | 'settings'>('main')
  const effectiveTab = hasTariffsTab || hasEventsTab ? tab : 'settings'

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !service) return
    setUploadingLogo(true)
    const result = await apiUpload(`/staff/services/${service.id}/logo`, file, staffToken, 'logo', true)
    setUploadingLogo(false)
    e.target.value = ''
    if (result.ok) {
      setService((prev) => (prev ? { ...prev, hasLogo: true } : prev))
      setCacheBust(Date.now())
      showToast('success', 'Logo mis à jour', service.name)
    } else {
      showToast('error', 'Échec', "Impossible d'envoyer le logo.")
    }
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !service) return
    setUploadingCover(true)
    const result = await apiUpload(`/staff/services/${service.id}/cover`, file, staffToken, 'cover', true)
    setUploadingCover(false)
    e.target.value = ''
    if (result.ok) {
      setService((prev) => (prev ? { ...prev, hasCoverImage: true } : prev))
      setCacheBust(Date.now())
      showToast('success', 'Image de couverture mise à jour', service.name)
    } else {
      showToast('error', 'Échec', "Impossible d'envoyer l'image de couverture.")
    }
  }

  async function handleDeleteCover() {
    if (!service) return
    setDeletingCover(true)
    const result = await apiCall('DELETE', `/staff/services/${service.id}/cover`, { staffToken })
    setDeletingCover(false)
    if (result.ok) {
      setService((prev) => (prev ? { ...prev, hasCoverImage: false } : prev))
      showToast('success', 'Image de couverture supprimée', service.name)
    } else {
      showToast('error', 'Échec', "Impossible de supprimer l'image de couverture.")
    }
  }

  async function handleAddClosure(e: React.FormEvent) {
    e.preventDefault()
    if (!service) return
    setCreatingClosure(true)
    setClosureError(null)
    const result = await apiCall<{ data: ServiceClosure }>('POST', `/staff/services/${service.id}/closures`, {
      staffToken,
      body: { label: closureLabel, startDate: closureStart, endDate: closureEnd },
    })
    setCreatingClosure(false)
    if (result.ok) {
      setService((prev) => (prev ? { ...prev, closures: [...(prev.closures ?? []), result.data.data] } : prev))
      setShowAddClosure(false)
      setClosureLabel('')
      setClosureStart('')
      setClosureEnd('')
      showToast('success', 'Période de fermeture ajoutée', closureLabel)
    } else if (result.status === 422) {
      setClosureError('La date de fin doit être postérieure à la date de début.')
    } else {
      setClosureError("Échec de l'ajout.")
    }
  }

  async function handleDeleteClosure(id: number) {
    if (!service) return
    const label = service.closures?.find((c) => c.id === id)?.label ?? ''
    setService((prev) => (prev ? { ...prev, closures: (prev.closures ?? []).filter((c) => c.id !== id) } : prev))
    const result = await apiCall('DELETE', `/staff/services/${service.id}/closures/${id}`, { staffToken })
    if (result.ok) showToast('success', 'Période de fermeture supprimée', label)
    else showToast('error', 'Échec', 'Impossible de supprimer la période de fermeture.')
  }

  if (loadFailed) return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
  if (!service) return showLoading ? <p className="text-sm text-gray-500">Chargement…</p> : null

  const logoUrl = service.hasLogo ? `${GATEWAY_URL}/services/${service.id}/logo${cacheBust ? `?v=${cacheBust}` : ''}` : null
  const coverUrl = service.hasCoverImage ? `${GATEWAY_URL}/services/${service.id}/cover${cacheBust ? `?v=${cacheBust}` : ''}` : null

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(`/staff/organismes/${orgId}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-aregie-blue"
      >
        <ArrowLeft size={15} />
        Retour à l'organisme
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden squircle rounded-2xl bg-gray-100">
            {logoUrl ? (
              <img src={logoUrl} alt={service.name} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon size={20} className="text-gray-300" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              {service.name}
            </h1>
            <p className="truncate text-sm text-gray-500">{SERVICE_TYPE_LABELS[service.serviceType] ?? service.serviceType}</p>
          </div>
        </div>
        <StatusBadge
          label={SERVICE_STATUS_LABELS[service.status] ?? service.status}
          className={SERVICE_STATUS_TINTS[service.status] ?? 'bg-gray-100 text-gray-600'}
        />
      </div>

      {(hasTariffsTab || hasEventsTab) && (
        <div className="mb-4 flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('main')}
            className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
              effectiveTab === 'main' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {hasTariffsTab ? 'Tarifs' : 'Évènements'}
          </button>
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

      {effectiveTab === 'main' && hasTariffsTab && <StaffServiceTariffs staffToken={staffToken} service={service} />}
      {effectiveTab === 'main' && hasEventsTab && <StaffServiceFormations staffToken={staffToken} service={service} />}

      {effectiveTab === 'settings' && (
        <div className="mx-auto max-w-2xl space-y-4">
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden squircle rounded-xl bg-gray-100">
                {logoUrl ? (
                  <img src={logoUrl} alt={service.name} className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon size={22} className="text-gray-300" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-700">Logo du service</p>
            </div>
            <label className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 squircle rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:w-auto">
              {uploadingLogo ? 'Envoi…' : 'Changer le logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                disabled={uploadingLogo}
                onChange={handleUploadLogo}
              />
            </label>
          </Card>

          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden squircle rounded-xl bg-gray-100">
                {coverUrl ? (
                  <img src={coverUrl} alt={service.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon size={22} className="text-gray-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Image de couverture</p>
                <p className="mt-0.5 text-xs text-gray-400">Affichée sur la page d'achat en ligne</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 squircle rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:w-auto">
                {uploadingCover ? 'Envoi…' : "Changer l'image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={handleUploadCover}
                />
              </label>
              {coverUrl && (
                <DangerButton
                  type="button"
                  onClick={handleDeleteCover}
                  disabled={deletingCover}
                  className="w-full justify-center px-3 py-2 sm:w-auto"
                >
                  {deletingCover ? 'Suppression…' : 'Supprimer'}
                </DangerButton>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                Fermetures ponctuelles
              </p>
              {!showAddClosure && (
                <button
                  type="button"
                  onClick={() => setShowAddClosure(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-aregie-blue"
                >
                  <Plus size={12} />
                  Ajouter
                </button>
              )}
            </div>

            {(service.closures ?? []).length === 0 && !showAddClosure && (
              <p className="flex items-center gap-1.5 text-sm text-gray-400">
                <CalendarOff size={14} />
                Aucune période de fermeture.
              </p>
            )}

            <div className="space-y-1.5">
              {(service.closures ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">{c.label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(`${c.startDate}T00:00:00`).toLocaleDateString('fr-FR')} —{' '}
                      {new Date(`${c.endDate}T00:00:00`).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleDeleteClosure(c.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {showAddClosure && (
              <form onSubmit={handleAddClosure} className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3">
                <TextInput
                  placeholder="Libellé (ex. vacances de Noël)"
                  value={closureLabel}
                  onChange={(e) => setClosureLabel(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <TextInput type="date" value={closureStart} onChange={(e) => setClosureStart(e.target.value)} required />
                  <TextInput type="date" value={closureEnd} onChange={(e) => setClosureEnd(e.target.value)} required />
                </div>
                {closureError && <p className="text-xs text-red-600">{closureError}</p>}
                <div className="flex gap-2">
                  <PrimaryButton type="submit" disabled={creatingClosure} className="flex-1 justify-center py-1.5 text-xs">
                    {creatingClosure ? 'Ajout…' : 'Ajouter'}
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => setShowAddClosure(false)}
                    className="flex-1 justify-center py-1.5 text-xs"
                  >
                    Annuler
                  </SecondaryButton>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default StaffServiceDetailPage
