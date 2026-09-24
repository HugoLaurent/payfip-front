import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Download, Pause, Plus, Search } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { downloadCsv } from '@/lib/exportCsv'
import {
  EmptyState,
  HeroButton,
  HeroGhostButton,
  LoadError,
  Modal,
  PrimaryButton,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { StaffHero } from '@/components/staff/StaffHero'
import { StaffRow, StaffTable, StaffTableSkeleton, Td } from '@/components/staff/StaffTable'
import { ORG_STATUS_LABELS, ORG_STATUS_TINTS } from '@/lib/serviceLabels'
import type { StaffOrganization } from '@/lib/types'

export function StaffOrganizationsPage() {
  const { staffToken } = useStaffAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [orgs, setOrgs] = useState<StaffOrganization[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [q, setQ] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setOrgs(null)
    setLoadFailed(false)
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffToken }).then((result) => {
      if (cancelled) return
      if (result.ok) setOrgs(result.data.data)
      else setLoadFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [staffToken, reloadKey])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const result = await apiCall('POST', '/staff/organizations', {
      staffToken,
      body: { name, domain, adminEmail, adminPassword },
    })

    setCreating(false)

    if (!result.ok) {
      setCreateError(result.status === 409 ? 'Ce domaine est déjà utilisé.' : 'Échec de la création.')
      showToast('error', 'Échec', "Impossible de créer l'organisme.")
      return
    }

    setShowCreate(false)
    setName('')
    setDomain('')
    setAdminEmail('')
    setAdminPassword('')
    setReloadKey((k) => k + 1)
    showToast('success', 'Organisme créé', name)
  }

  const filtered = (orgs ?? []).filter((org) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return org.name.toLowerCase().includes(needle) || org.domain.toLowerCase().includes(needle)
  })
  const activeCount = (orgs ?? []).filter((o) => o.status === 'active').length
  const suspendedCount = (orgs ?? []).filter((o) => o.status === 'suspended').length

  function exportCsv() {
    downloadCsv(
      'organismes.csv',
      ['Nom', 'Domaine', 'Statut'],
      filtered.map((org) => [org.name, org.domain, ORG_STATUS_LABELS[org.status] ?? org.status])
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaffHero
        icon={<Building2 size={13} />}
        eyebrow="Tous les clients AREGIE"
        title="Organismes"
        actions={
          <>
            <HeroGhostButton type="button" onClick={exportCsv} disabled={!orgs || orgs.length === 0}>
              <Download size={14} />
              Exporter
            </HeroGhostButton>
            <HeroButton type="button" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Nouvel organisme
            </HeroButton>
          </>
        }
        stats={[
          {
            label: 'Organismes actifs',
            value: orgs ? String(activeCount) : null,
            note: orgs ? `sur ${orgs.length} au total` : undefined,
            hasNote: true,
            icon: <Building2 size={14} />,
            tone: 'blue',
          },
          {
            label: 'Suspendus',
            value: orgs ? String(suspendedCount) : null,
            icon: <Pause size={14} />,
            tone: orgs && suspendedCount > 0 ? 'red' : 'gray',
          },
        ]}
      />

      <div className="min-h-0 flex-1">
      {loadFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
      {!loadFailed && orgs === null && <StaffTableSkeleton columns={4} />}
      {!loadFailed && orgs?.length === 0 && <EmptyState icon={<Building2 size={28} />} label="Aucun organisme." />}

      {!loadFailed && orgs && orgs.length > 0 && (
        <StaffTable
          headers={['Nom', 'Domaine', 'Statut', '']}
          toolbar={
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
              <TextInput
                placeholder="Nom ou domaine…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          }
          footer={<p className="text-xs text-gray-400">{filtered.length} organisme{filtered.length > 1 ? 's' : ''}</p>}
        >
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                Aucun organisme ne correspond à « {q} ».
              </td>
            </tr>
          ) : (
            filtered.map((org) => (
              <StaffRow key={org.id} onClick={() => navigate(`/staff/organismes/${org.id}`)}>
                <Td className="font-medium text-gray-900">{org.name}</Td>
                <Td>{org.domain}</Td>
                <Td>
                  <StatusBadge
                    label={ORG_STATUS_LABELS[org.status] ?? org.status}
                    className={ORG_STATUS_TINTS[org.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                </Td>
                <Td>
                  <ChevronRight size={16} className="text-gray-300" />
                </Td>
              </StaffRow>
            ))
          )}
        </StaffTable>
      )}
      </div>

      {showCreate && (
        <Modal title="Nouvel organisme" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Domaine</label>
              <TextInput value={domain} onChange={(e) => setDomain(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email du premier admin</label>
              <TextInput type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
              <TextInput
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={6}
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

export default StaffOrganizationsPage
