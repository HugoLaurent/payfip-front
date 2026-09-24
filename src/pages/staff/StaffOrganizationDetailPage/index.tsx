import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Building2, Check, Plus, X } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { Card, DangerButton, LoadError, Pagination, PrimaryButton, SecondaryButton, StatusBadge, TextInput } from '@/components/ui'
import { ORG_STATUS_LABELS, ORG_STATUS_TINTS } from '@/lib/serviceLabels'
import type { PageMeta, ServiceRow, StaffOrganization } from '@/lib/types'
import { ServiceListItem } from './ServiceListItem'
import { SuspendModal, DeleteOrgModal, CreateServiceModal } from './OrganizationModals'

const SERVICES_PER_PAGE = 25

export function StaffOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { staffToken } = useStaffAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [org, setOrg] = useState<StaffOrganization | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(org === null && !loadFailed)

  const [servicesPage, setServicesPage] = useState(1)
  const {
    data: services,
    meta: servicesMeta,
    loadFailed: servicesFailed,
    reload: reloadServices,
  } = usePaginatedResource<ServiceRow, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/services?orgId=${id}&page=${servicesPage}&perPage=${SERVICES_PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, id, reloadKey, servicesPage],
  })

  useEffect(() => {
    let cancelled = false
    setOrg(null)
    setLoadFailed(false)
    apiCall<{ data: StaffOrganization }>('GET', `/staff/organizations/${id}`, { staffToken }).then((result) => {
      if (cancelled) return
      if (result.ok) setOrg(result.data.data)
      else setLoadFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [staffToken, id, reloadKey])

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
      staffToken,
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
      staffToken,
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
      staffToken,
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

  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!org) return
    setDeleting(true)
    const result = await apiCall('DELETE', `/staff/organizations/${org.id}`, { staffToken })
    setDeleting(false)
    if (result.ok) {
      showToast('success', 'Organisme supprimé', org.name)
      navigate('/staff/organismes')
    } else {
      showToast('error', 'Échec', "Impossible de supprimer l'organisme.")
    }
  }

  const [togglingServiceId, setTogglingServiceId] = useState<number | null>(null)

  async function toggleService(service: ServiceRow) {
    setTogglingServiceId(service.id)
    const nextStatus = service.status === 'active' ? 'archived' : 'active'
    const result = await apiCall('PATCH', `/staff/services/${service.id}`, {
      staffToken,
      body: { status: nextStatus },
    })
    setTogglingServiceId(null)
    if (result.ok) {
      await reloadServices()
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
      staffToken,
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
    await reloadServices()
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
      staffToken,
      body: { name: serviceName, serviceType, numcli },
    })

    setCreatingService(false)

    if (!result.ok) {
      setCreateServiceError('Échec de la création — vérifiez le numéro client (6 chiffres).')
      showToast('error', 'Échec', 'Impossible de créer le service.')
      return
    }

    setShowCreateService(false)
    if (servicesPage === 1) await reloadServices()
    else setServicesPage(1)
    const createdLinkCode = (result.data as { linkCode?: string } | undefined)?.linkCode
    showToast(
      'success',
      'Service créé',
      createdLinkCode ? `Code de liaison AREGIE à transmettre : ${createdLinkCode}` : serviceName
    )
  }

  if (loadFailed) {
    return <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
  }

  if (!org) {
    return showLoading ? <p className="text-sm text-gray-500">Chargement…</p> : null
  }

  const suspended = org.status === 'suspended'

  return (
    <div className="mx-auto max-w-5xl">
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
                  aria-label="Enregistrer le nom"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
                  aria-label="Annuler le renommage"
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
            <>
              <SecondaryButton type="button" onClick={handleReactivate} disabled={suspending} className="px-3 py-1.5">
                {suspending ? 'Réactivation…' : "Réactiver l'organisme"}
              </SecondaryButton>
              <DangerButton
                type="button"
                onClick={() => {
                  setDeleteConfirmName('')
                  setShowDelete(true)
                }}
                className="px-3 py-1.5"
              >
                Supprimer l'organisme
              </DangerButton>
            </>
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

        {servicesFailed && <LoadError onRetry={reloadServices} />}
        {!servicesFailed && services === null && <p className="text-sm text-gray-500">Chargement…</p>}
        {!servicesFailed && services?.length === 0 && <p className="text-sm text-gray-400">Aucun service.</p>}

        {!servicesFailed && services && services.length > 0 && (
          <div className="flex flex-col">
            {services.map((s) => (
              <ServiceListItem
                key={s.id}
                service={s}
                suspended={suspended}
                togglingServiceId={togglingServiceId}
                onToggleService={toggleService}
                onManage={(service) => navigate(`/staff/organismes/${id}/services/${service.id}`)}
                editingSlugId={editingSlugId}
                slugInput={slugInput}
                slugError={slugError}
                savingSlug={savingSlug}
                onStartEditSlug={startEditingSlug}
                onChangeSlugInput={setSlugInput}
                onSaveSlug={handleSaveSlug}
                onCancelEditSlug={() => setEditingSlugId(null)}
              />
            ))}
          </div>
        )}
        {servicesMeta && (
          <Pagination
            currentPage={servicesMeta.currentPage}
            lastPage={servicesMeta.lastPage}
            total={servicesMeta.total}
            onChange={setServicesPage}
          />
        )}
      </Card>

      {showSuspend && (
        <SuspendModal
          org={org}
          suspendMessage={suspendMessage}
          onChangeSuspendMessage={setSuspendMessage}
          suspending={suspending}
          onConfirm={handleSuspend}
          onClose={() => setShowSuspend(false)}
        />
      )}

      {showDelete && (
        <DeleteOrgModal
          org={org}
          deleteConfirmName={deleteConfirmName}
          onChangeDeleteConfirmName={setDeleteConfirmName}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}

      {showCreateService && (
        <CreateServiceModal
          serviceName={serviceName}
          onChangeServiceName={setServiceName}
          serviceType={serviceType}
          onChangeServiceType={setServiceType}
          numcli={numcli}
          onChangeNumcli={setNumcli}
          createServiceError={createServiceError}
          creatingService={creatingService}
          onSubmit={handleCreateService}
          onClose={() => setShowCreateService(false)}
        />
      )}
    </div>
  )
}

export default StaffOrganizationDetailPage
