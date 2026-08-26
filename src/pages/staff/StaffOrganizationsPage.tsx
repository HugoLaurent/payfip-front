import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Plus } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { useToast } from '@/lib/useToast'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { EmptyState, LoadError, Modal, PageHeader, PrimaryButton, StatusBadge, TextInput } from '@/components/ui'
import { StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import type { StaffOrganization } from '@/lib/types'

const ORG_STATUS_LABELS: Record<string, string> = { active: 'Actif', suspended: 'Suspendu' }
const ORG_STATUS_TINTS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-600',
}

export function StaffOrganizationsPage() {
  const { staffToken } = useStaffAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [orgs, setOrgs] = useState<StaffOrganization[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(orgs === null && !loadFailed)

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    setOrgs(null)
    setLoadFailed(false)
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffToken }).then((result) => {
      if (result.ok) setOrgs(result.data.data)
      else setLoadFailed(true)
    })
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

  return (
    <div>
      <PageHeader
        icon={<Building2 size={20} />}
        title="Organismes"
        subtitle="Tous les clients AREGIE"
        action={
          <PrimaryButton type="button" onClick={() => setShowCreate(true)} className="px-3.5 py-2">
            <Plus size={15} />
            Nouvel organisme
          </PrimaryButton>
        }
      />

      {loadFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
      {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && orgs?.length === 0 && <EmptyState icon={<Building2 size={28} />} label="Aucun organisme." />}

      {!loadFailed && orgs && orgs.length > 0 && (
        <StaffTable headers={['Nom', 'Domaine', 'Statut', '']}>
          {orgs.map((org) => (
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
          ))}
        </StaffTable>
      )}

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
