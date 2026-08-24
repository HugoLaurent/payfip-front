import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Building2, Check, Plus, X } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import {
  Card,
  DangerButton,
  LoadError,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  Textarea,
  TextInput,
} from '@/components/ui'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { ServiceRow, StaffOrganization } from '@/lib/types'

const ORG_STATUS_LABELS: Record<string, string> = { active: 'Actif', suspended: 'Suspendu' }
const ORG_STATUS_TINTS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-600',
}

export function StaffOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { staffKey } = useStaffAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [org, setOrg] = useState<StaffOrganization | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(org === null && !loadFailed)

  const [services, setServices] = useState<ServiceRow[] | null>(null)
  const [servicesFailed, setServicesFailed] = useState(false)

  useEffect(() => {
    setOrg(null)
    setLoadFailed(false)
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffKey }).then((result) => {
      if (!result.ok) {
        setLoadFailed(true)
        return
      }
      const found = result.data.data.find((o) => String(o.id) === id)
      if (!found) {
        setLoadFailed(true)
        return
      }
      setOrg(found)
    })
  }, [staffKey, id, reloadKey])

  useEffect(() => {
    setServices(null)
    setServicesFailed(false)
    apiCall<{ data: ServiceRow[] }>('GET', `/staff/services?orgId=${id}&perPage=100`, { staffKey }).then(
      (result) => {
        if (result.ok) setServices(result.data.data)
        else setServicesFailed(true)
      }
    )
  }, [staffKey, id, reloadKey])

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  function startEditingName() {
    setNameInput(org?.name ?? '')
    setEditingName(true)
  }

  async function handleSaveName() {
    if (!org || !nameInput.trim()) return
    setSavingName(true)
    const result = await apiCall<{ data: StaffOrganization }>('PATCH', `/staff/organizations/${org.id}`, {
      staffKey,
      body: { name: nameInput.trim() },
    })
    setSavingName(false)
    if (result.ok) {
      setOrg(result.data.data)
      setEditingName(false)
      showToast('success', 'Organisme renommé', result.data.data.name)
    } else {
      showToast('error', 'Échec', "Impossible de renommer l'organisme.")
    }
  }

  const [showSuspend, setShowSuspend] = useState(false)
  const [suspendMessage, setSuspendMessage] = useState('')
  const [suspending, setSuspending] = useState(false)

  async function handleSuspend() {
    if (!org) return
    setSuspending(true)
    const result = await apiCall<{ data: StaffOrganization }>('PATCH', `/staff/organizations/${org.id}`, {
      staffKey,
      body: { status: 'suspended', suspendedMessage: suspendMessage.trim() || null },
    })
    setSuspending(false)
    if (result.ok) {
      setOrg(result.data.data)
      setShowSuspend(false)
      setSuspendMessage('')
      showToast('success', 'Organisme suspendu', `${org.name} ne peut plus se connecter.`)
    } else {
      showToast('error', 'Échec', "Impossible de suspendre l'organisme.")
    }
  }

  async function handleReactivate() {
    if (!org) return
    setSuspending(true)
    const result = await apiCall<{ data: StaffOrganization }>('PATCH', `/staff/organizations/${org.id}`, {
      staffKey,
      body: { status: 'active' },
    })
    setSuspending(false)
    if (result.ok) {
      setOrg(result.data.data)
      showToast('success', 'Organisme réactivé', `${org.name} est de nouveau actif.`)
    } else {
      showToast('error', 'Échec', "Impossible de réactiver l'organisme.")
    }
  }

  const [togglingServiceId, setTogglingServiceId] = useState<number | null>(null)

  async function toggleService(service: ServiceRow) {
    setTogglingServiceId(service.id)
    const nextStatus = service.status === 'active' ? 'archived' : 'active'
    const result = await apiCall('PATCH', `/staff/services/${service.id}`, {
      staffKey,
      body: { status: nextStatus },
    })
    setTogglingServiceId(null)
    if (result.ok) {
      setReloadKey((k) => k + 1)
      showToast(
        'success',
        nextStatus === 'archived' ? 'Service fermé' : 'Service réactivé',
        service.name
      )
    } else {
      showToast('error', 'Échec', 'Impossible de changer le statut du service.')
    }
  }

  // Le lien public (slug) est staff-only — jamais éditable par l'organisme,
  // même un admin (voir ServicesController#update côté back).
  const [editingSlugId, setEditingSlugId] = useState<number | null>(null)
  const [slugInput, setSlugInput] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)

  function startEditingSlug(service: ServiceRow) {
    setEditingSlugId(service.id)
    setSlugInput(service.slug ?? '')
    setSlugError(null)
  }

  async function handleSaveSlug(service: ServiceRow) {
    const trimmed = slugInput.trim()
    setSavingSlug(true)
    setSlugError(null)
    const result = await apiCall('PATCH', `/staff/services/${service.id}`, {
      staffKey,
      body: { slug: trimmed || null },
    })
    setSavingSlug(false)
    if (!result.ok) {
      setSlugError(
        result.status === 409 ? 'Ce lien est déjà utilisé par un autre service.' : 'Lien invalide.'
      )
      showToast('error', 'Échec', 'Impossible de mettre à jour le lien public.')
      return
    }
    setEditingSlugId(null)
    setReloadKey((k) => k + 1)
    showToast('success', 'Lien public mis à jour', service.name)
  }

  const [showCreateService, setShowCreateService] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [serviceType, setServiceType] = useState<'billetterie' | 'factures'>('billetterie')
  const [numcli, setNumcli] = useState('')
  const [creatingService, setCreatingService] = useState(false)
  const [createServiceError, setCreateServiceError] = useState<string | null>(null)

  function openCreateService() {
    setServiceName('')
    setServiceType('billetterie')
    setNumcli('')
    setCreateServiceError(null)
    setShowCreateService(true)
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault()
    setCreatingService(true)
    setCreateServiceError(null)

    const result = await apiCall('POST', `/staff/organizations/${id}/services`, {
      staffKey,
      body: { name: serviceName, serviceType, numcli },
    })

    setCreatingService(false)

    if (!result.ok) {
      setCreateServiceError('Échec de la création — vérifiez le numéro client (6 chiffres).')
      showToast('error', 'Échec', 'Impossible de créer le service.')
      return
    }

    setShowCreateService(false)
    setReloadKey((k) => k + 1)
    showToast('success', 'Service créé', serviceName)
  }

  if (loadFailed) {
    return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
  }

  if (!org) {
    return showLoading ? <p className="text-sm text-gray-500">Chargement…</p> : null
  }

  const suspended = org.status === 'suspended'

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/staff/organismes')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-aregie-blue"
      >
        <ArrowLeft size={15} />
        Organismes
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="squircle flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-aregie-deep/10 text-aregie-deep">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <TextInput
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  className="max-w-[280px] py-1"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName || !nameInput.trim()}
                  className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                  {org.name}
                </h1>
                <button
                  type="button"
                  onClick={startEditingName}
                  className="shrink-0 text-xs font-semibold text-aregie-blue"
                >
                  Renommer
                </button>
              </div>
            )}
            <p className="truncate text-sm text-gray-500">{org.domain}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={ORG_STATUS_LABELS[org.status] ?? org.status}
            className={ORG_STATUS_TINTS[org.status] ?? 'bg-gray-100 text-gray-600'}
          />
          {suspended ? (
            <SecondaryButton type="button" onClick={handleReactivate} disabled={suspending} className="px-3 py-1.5">
              {suspending ? 'Réactivation…' : "Réactiver l'organisme"}
            </SecondaryButton>
          ) : (
            <DangerButton type="button" onClick={() => setShowSuspend(true)} className="px-3 py-1.5">
              Suspendre l'organisme
            </DangerButton>
          )}
        </div>
      </div>

      {suspended && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
            <AlertTriangle size={13} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-800">
              Organisme suspendu
              {org.suspendedAt && ` depuis le ${new Date(org.suspendedAt).toLocaleDateString('fr-FR')}`}
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              {org.suspendedMessage ||
                'Tous les agents sont déconnectés ; les services de cet organisme affichent "fermé" au public.'}
            </p>
          </div>
        </div>
      )}

      <Card className={suspended ? 'opacity-75' : ''}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              Services
            </p>
            <p className="text-xs text-gray-400">
              {suspended ? "Fermés au public tant que l'organisme reste suspendu" : 'Billetterie et facturation de cet organisme'}
            </p>
          </div>
          <PrimaryButton
            type="button"
            onClick={openCreateService}
            disabled={suspended}
            className="px-3.5 py-2"
          >
            <Plus size={15} />
            Nouveau service
          </PrimaryButton>
        </div>

        {servicesFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
        {!servicesFailed && services === null && <p className="text-sm text-gray-500">Chargement…</p>}
        {!servicesFailed && services?.length === 0 && <p className="text-sm text-gray-400">Aucun service.</p>}

        {!servicesFailed && services && services.length > 0 && (
          <div className="flex flex-col">
            {services.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 border-b border-gray-50 py-3 last:border-0">
                <div className="flex items-center gap-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {SERVICE_TYPE_LABELS[s.serviceType] ?? s.serviceType}
                      {s.numcli && ` · Client PayFiP n° ${s.numcli}`}
                    </p>
                  </div>
                  {suspended ? (
                    <StatusBadge label="Fermé (organisme)" className="bg-red-100 text-red-600" />
                  ) : (
                    <>
                      <StatusBadge
                        label={SERVICE_STATUS_LABELS[s.status] ?? s.status}
                        className={SERVICE_STATUS_TINTS[s.status] ?? 'bg-gray-100 text-gray-600'}
                      />
                      {s.status === 'active' ? (
                        <DangerButton
                          type="button"
                          onClick={() => toggleService(s)}
                          disabled={togglingServiceId === s.id}
                          className="px-3 py-1.5"
                        >
                          {togglingServiceId === s.id ? '…' : 'Fermer'}
                        </DangerButton>
                      ) : (
                        <SecondaryButton
                          type="button"
                          onClick={() => toggleService(s)}
                          disabled={togglingServiceId === s.id}
                          className="px-3 py-1.5"
                        >
                          {togglingServiceId === s.id ? '…' : 'Réactiver'}
                        </SecondaryButton>
                      )}
                    </>
                  )}
                </div>

                {editingSlugId === s.id ? (
                  <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                    <span className="shrink-0 text-xs text-gray-400">/{s.serviceType}/</span>
                    <TextInput
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
                      placeholder="mon-service"
                      autoFocus
                      className="max-w-[200px] py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveSlug(s)}
                      disabled={savingSlug}
                      className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 disabled:opacity-50"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSlugId(null)}
                      className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
                    >
                      <X size={13} />
                    </button>
                    {slugError && <p className="w-full text-xs text-red-600">{slugError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pl-0.5">
                    <span className="text-xs text-gray-400">
                      {s.slug ? `/${s.serviceType}/${s.slug}` : 'Aucun lien public'}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEditingSlug(s)}
                      className="text-xs font-semibold text-aregie-blue"
                    >
                      Modifier
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showSuspend && (
        <Modal title="Suspendre l'organisme" onClose={() => setShowSuspend(false)}>
          <p className="mb-4 text-sm text-gray-600">
            Tous les administrateurs et agents de <strong>{org.name}</strong> seront déconnectés et ne
            pourront plus se reconnecter. Leurs services publics afficheront "fermé" aux citoyens. Vous
            pourrez réactiver l'organisme à tout moment.
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Message affiché en interne (optionnel)</label>
            <Textarea
              value={suspendMessage}
              onChange={(e) => setSuspendMessage(e.target.value)}
              placeholder="Ex. impayé, contactez la facturation"
              rows={3}
              maxLength={300}
            />
          </div>
          <div className="flex gap-2">
            <DangerButton type="button" onClick={handleSuspend} disabled={suspending} className="flex-1 justify-center py-2">
              {suspending ? 'Suspension…' : 'Suspendre'}
            </DangerButton>
            <SecondaryButton type="button" onClick={() => setShowSuspend(false)} className="flex-1 justify-center">
              Annuler
            </SecondaryButton>
          </div>
        </Modal>
      )}

      {showCreateService && (
        <Modal title="Nouveau service" onClose={() => setShowCreateService(false)}>
          <form onSubmit={handleCreateService} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom du service</label>
              <TextInput value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <SelectInput
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as 'billetterie' | 'factures')}
              >
                <option value="billetterie">Billetterie</option>
                <option value="factures">Facture</option>
              </SelectInput>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Numéro client PayFiP</label>
              <TextInput value={numcli} onChange={(e) => setNumcli(e.target.value)} placeholder="6 chiffres" required />
            </div>
            {createServiceError && <p className="text-sm text-red-600">{createServiceError}</p>}
            <PrimaryButton type="submit" disabled={creatingService} className="w-full">
              {creatingService ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default StaffOrganizationDetailPage
