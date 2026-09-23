import { useEffect, useState } from 'react'
import { Download, KeyRound, Plus, Search, Store } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { downloadCsv } from '@/lib/exportCsv'
import {
  EmptyState,
  HeroButton,
  HeroGhostButton,
  LoadError,
  Modal,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { AregieMailKeyControl } from '@/components/staff/AregieMailKeyControl'
import { StaffHero } from '@/components/staff/StaffHero'
import { StaffRow, StaffTable, StaffTableSkeleton, Td } from '@/components/staff/StaffTable'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { PageMeta, ServiceRow, StaffOrganization } from '@/lib/types'

const PER_PAGE = 20

export function StaffServicesPage() {
  const { staffToken } = useStaffAuth()
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: services,
    meta,
    loadFailed,
    reload,
  } = usePaginatedResource<ServiceRow, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/services?q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`, { staffToken }),
    deps: [staffToken, q, page],
  })

  const [orgs, setOrgs] = useState<StaffOrganization[]>([])
  useEffect(() => {
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffToken }).then((result) => {
      if (result.ok) setOrgs(result.data.data)
    })
  }, [staffToken])
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]))

  const [mailKeyService, setMailKeyService] = useState<ServiceRow | null>(null)

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
      staffToken,
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

  function exportCsv() {
    downloadCsv(
      'services.csv',
      ['Service', 'Organisme', 'Type', 'Numcli', 'Statut'],
      (services ?? []).map((s) => [
        s.name,
        orgNameById.get(s.orgId) ?? String(s.orgId),
        SERVICE_TYPE_LABELS[s.serviceType] ?? s.serviceType,
        s.numcli ?? '',
        SERVICE_STATUS_LABELS[s.status] ?? s.status,
      ])
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaffHero
        icon={<Store size={13} />}
        eyebrow="Tous organismes confondus"
        title="Services"
        actions={
          <>
            <HeroGhostButton type="button" onClick={exportCsv} disabled={!services || services.length === 0}>
              <Download size={14} />
              Exporter
            </HeroGhostButton>
            <HeroButton type="button" onClick={openCreate} disabled={orgs.length === 0}>
              <Plus size={14} />
              Nouveau service
            </HeroButton>
          </>
        }
        stats={[{ label: 'Services', value: meta ? String(meta.total) : null, icon: <Store size={14} />, tone: 'blue' }]}
      />

      <div className="min-h-0 flex-1">
      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && services === null && <StaffTableSkeleton columns={6} />}
      {!loadFailed && services?.length === 0 && <EmptyState icon={<Store size={28} />} label="Aucun service." />}

      {!loadFailed && services && services.length > 0 && (
        <StaffTable
          headers={['Service', 'Organisme', 'Type', 'Numcli', 'Statut', 'Envoi']}
          toolbar={
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
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
          }
          footer={
            meta && meta.lastPage > 1 ? (
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            ) : (
              <p className="text-xs text-gray-400">{meta?.total ?? services.length} service{(meta?.total ?? services.length) > 1 ? 's' : ''}</p>
            )
          }
        >
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
              <Td>
                <SecondaryButton
                  type="button"
                  onClick={() => setMailKeyService(s)}
                  className="px-3 py-1.5 text-xs"
                >
                  <KeyRound size={13} />
                  Clé API
                </SecondaryButton>
              </Td>
            </StaffRow>
          ))}
        </StaffTable>
      )}
      </div>

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

      {mailKeyService && (
        <Modal title={`Clé API AREGIE Mail — ${mailKeyService.name}`} onClose={() => setMailKeyService(null)}>
          <p className="mb-4 text-xs text-gray-500">
            Utilisée pour les confirmations envoyées au nom de ce service (billets, factures,
            inscriptions selon son type). Sans clé propre, ce service n'a pas d'envoi possible tant
            qu'elle n'est pas configurée ici — voir CLIENT_GUIDE.md du dépôt AREGIE_MAIL pour créer
            un client et connecter sa boîte d'envoi.
          </p>
          <AregieMailKeyControl serviceId={mailKeyService.id} />
        </Modal>
      )}
    </div>
  )
}

export default StaffServicesPage
