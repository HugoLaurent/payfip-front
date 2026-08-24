import { useEffect, useState } from 'react'
import { Plus, Search, Store } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import {
  EmptyState,
  LoadError,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { PageMeta, ServiceRow, StaffOrganization } from '@/lib/types'

const PER_PAGE = 20

export function StaffServicesPage() {
  const { staffKey } = useStaffAuth()
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: services,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<ServiceRow, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/services?q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`, { staffKey }),
    deps: [staffKey, q, page],
  })

  const [orgs, setOrgs] = useState<StaffOrganization[]>([])
  useEffect(() => {
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffKey }).then((result) => {
      if (result.ok) setOrgs(result.data.data)
    })
  }, [staffKey])
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]))

  const [showCreate, setShowCreate] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState<'billetterie' | 'factures'>('billetterie')
  const [numcli, setNumcli] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function openCreate() {
    setOrgId(orgs[0] ? String(orgs[0].id) : '')
    setName('')
    setServiceType('billetterie')
    setNumcli('')
    setCreateError(null)
    setShowCreate(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const result = await apiCall('POST', `/staff/organizations/${orgId}/services`, {
      staffKey,
      body: { name, serviceType, numcli },
    })

    setCreating(false)

    if (!result.ok) {
      setCreateError('Échec de la création — vérifiez le numéro client (6 chiffres).')
      showToast('error', 'Échec', 'Impossible de créer le service.')
      return
    }

    setShowCreate(false)
    reload()
    showToast('success', 'Service créé', name)
  }

  return (
    <div>
      <PageHeader
        icon={<Store size={20} />}
        title="Services"
        subtitle="Tous organismes confondus"
        action={
          <PrimaryButton type="button" onClick={openCreate} className="px-3.5 py-2" disabled={orgs.length === 0}>
            <Plus size={15} />
            Nouveau service
          </PrimaryButton>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Rechercher un service…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && services?.length === 0 && <EmptyState icon={<Store size={28} />} label="Aucun service." />}

      {!loadFailed && services && services.length > 0 && (
        <>
          <StaffTable headers={['Service', 'Organisme', 'Type', 'Numcli', 'Statut']}>
            {services.map((s) => (
              <StaffRow key={s.id}>
                <Td className="font-medium text-gray-900">{s.name}</Td>
                <Td>{orgNameById.get(s.orgId) ?? s.orgId}</Td>
                <Td>{SERVICE_TYPE_LABELS[s.serviceType] ?? s.serviceType}</Td>
                <Td className="font-mono text-xs">{s.numcli ?? '—'}</Td>
                <Td>
                  <StatusBadge
                    label={SERVICE_STATUS_LABELS[s.status] ?? s.status}
                    className={SERVICE_STATUS_TINTS[s.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                </Td>
              </StaffRow>
            ))}
          </StaffTable>
          {meta && meta.lastPage > 1 && (
            <div className="mt-4 squircle rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(20,25,60,0.06)]">
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {showCreate && (
        <Modal title="Nouveau service" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Organisme</label>
              <SelectInput value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom du service</label>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
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
              <TextInput
                value={numcli}
                onChange={(e) => setNumcli(e.target.value)}
                placeholder="6 chiffres"
                required
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <PrimaryButton type="submit" disabled={creating} className="w-full">
              {creating ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default StaffServicesPage
