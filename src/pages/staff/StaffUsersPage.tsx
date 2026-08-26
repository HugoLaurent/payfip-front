import { useEffect, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { EmptyState, LoadError, PageHeader, Pagination, SelectInput, StatusBadge, TextInput } from '@/components/ui'
import { StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import type { PageMeta, StaffOrganization } from '@/lib/types'

const PER_PAGE = 25

const ROLE_LABELS: Record<string, string> = { admin: 'Administrateur', agent: 'Agent' }
const STATUS_TINTS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  disabled: 'bg-gray-100 text-gray-500',
  deleted: 'bg-red-100 text-red-600',
}

interface StaffUser {
  id: number
  orgId: number
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  status: string
  lastLoginAt: string | null
}

export function StaffUsersPage() {
  const { staffToken } = useStaffAuth()
  const [q, setQ] = useState('')
  const [orgId, setOrgId] = useState('')
  const [page, setPage] = useState(1)

  const [orgs, setOrgs] = useState<StaffOrganization[]>([])
  useEffect(() => {
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffToken }).then((result) => {
      if (result.ok) setOrgs(result.data.data)
    })
  }, [staffToken])
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]))

  const {
    data: users,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffUser, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/users?q=${encodeURIComponent(q)}${orgId ? `&orgId=${orgId}` : ''}&page=${page}&perPage=${PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, q, orgId, page],
  })

  return (
    <div>
      <PageHeader icon={<Users size={20} />} title="Utilisateurs" subtitle="Identifiants, tous organismes confondus" />

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <TextInput
            placeholder="Rechercher un email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <SelectInput
          value={orgId}
          onChange={(e) => {
            setOrgId(e.target.value)
            setPage(1)
          }}
          className="w-auto"
        >
          <option value="">Tous les organismes</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectInput>
      </div>

      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && users?.length === 0 && <EmptyState icon={<Users size={28} />} label="Aucun utilisateur." />}

      {!loadFailed && users && users.length > 0 && (
        <>
          <StaffTable headers={['Email', 'Nom', 'Organisme', 'Rôle', 'Statut', 'Dernière connexion']}>
            {users.map((u) => (
              <StaffRow key={u.id}>
                <Td className="font-medium text-gray-900">{u.email}</Td>
                <Td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</Td>
                <Td>{orgNameById.get(u.orgId) ?? u.orgId}</Td>
                <Td>{ROLE_LABELS[u.role] ?? u.role}</Td>
                <Td>
                  <StatusBadge label={u.status} className={STATUS_TINTS[u.status] ?? 'bg-gray-100 text-gray-600'} />
                </Td>
                <Td className="text-gray-400">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : '—'}
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
    </div>
  )
}

export default StaffUsersPage
