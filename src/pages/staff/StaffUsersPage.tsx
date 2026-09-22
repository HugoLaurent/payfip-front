import { useEffect, useState } from 'react'
import { KeyRound, Plus, Search, Users } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useToast } from '@/lib/useToast'
import {
  DangerButton,
  EmptyState,
  LoadError,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import { DEFAULT_PERMISSIONS, getPermissionLabels } from '@/pages/org/UsersManager/permissions'
import type { AgentPermissions, PageMeta, ServiceRow, StaffOrganization } from '@/lib/types'

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
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [orgId, setOrgId] = useState('')
  const [page, setPage] = useState(1)

  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createOrgId, setCreateOrgId] = useState('')
  const [createRole, setCreateRole] = useState<'agent' | 'admin'>('agent')
  const [createFirstName, setCreateFirstName] = useState('')
  const [createLastName, setCreateLastName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createServiceIds, setCreateServiceIds] = useState<number[]>([])
  const [createPermissions, setCreatePermissions] = useState<AgentPermissions>(DEFAULT_PERMISSIONS)
  const [createOrgServices, setCreateOrgServices] = useState<ServiceRow[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!showCreate || !createOrgId) {
      setCreateOrgServices(null)
      return
    }
    apiCall<{ data: ServiceRow[] }>('GET', `/staff/services?orgId=${createOrgId}&perPage=100`, {
      staffToken,
    }).then((result) => {
      if (result.ok) setCreateOrgServices(result.data.data)
    })
  }, [showCreate, createOrgId, staffToken])

  function openCreate() {
    setCreateOrgId('')
    setCreateRole('agent')
    setCreateFirstName('')
    setCreateLastName('')
    setCreateEmail('')
    setCreatePassword('')
    setCreateServiceIds([])
    setCreatePermissions(DEFAULT_PERMISSIONS)
    setCreateError(null)
    setShowCreate(true)
  }

  const relevantCreateLabels = Array.from(
    new Set(
      (createOrgServices ?? [])
        .filter((s) => createServiceIds.includes(s.id))
        .map((s) => s.serviceType)
    )
  )
    .flatMap((type) => getPermissionLabels(type))
    .filter((entry, index, all) => all.findIndex((e) => e.key === entry.key) === index)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createOrgId) return
    if (createRole === 'agent' && createServiceIds.length === 0) {
      setCreateError('Choisissez au moins un service.')
      return
    }
    setCreating(true)
    setCreateError(null)
    const result = await apiCall('POST', '/staff/users', {
      staffToken,
      body:
        createRole === 'admin'
          ? {
              orgId: Number(createOrgId),
              firstName: createFirstName,
              lastName: createLastName,
              email: createEmail,
              password: createPassword,
              role: 'admin',
            }
          : {
              orgId: Number(createOrgId),
              firstName: createFirstName,
              lastName: createLastName,
              email: createEmail,
              password: createPassword,
              serviceIds: createServiceIds,
              ...createPermissions,
            },
    })
    setCreating(false)
    if (result.ok) {
      showToast('success', 'Utilisateur créé', createEmail)
      setShowCreate(false)
      reload()
    } else if (result.status === 409) {
      setCreateError('Cet email est déjà utilisé.')
    } else {
      setCreateError('Échec de la création.')
    }
  }

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

  async function toggleStatus(u: StaffUser) {
    const nextStatus = u.status === 'active' ? 'inactive' : 'active'
    setTogglingId(u.id)
    const result = await apiCall('PATCH', `/staff/users/${u.id}`, {
      staffToken,
      body: { status: nextStatus },
    })
    setTogglingId(null)
    if (result.ok) {
      showToast('success', nextStatus === 'active' ? 'Utilisateur réactivé' : 'Utilisateur désactivé', u.email)
      reload()
    } else if (result.status === 409) {
      showToast('error', 'Échec', "C'est le dernier administrateur actif de cet organisme.")
    } else {
      showToast('error', 'Échec', 'Impossible de mettre à jour le statut.')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setResettingPassword(true)
    setResetPasswordError(null)
    const result = await apiCall('PATCH', `/staff/users/${resetTarget.id}/password`, {
      staffToken,
      body: { newPassword: resetPasswordValue },
    })
    setResettingPassword(false)
    if (result.ok) {
      showToast('success', 'Mot de passe réinitialisé', resetTarget.email)
      setResetTarget(null)
      setResetPasswordValue('')
    } else if (result.status === 422) {
      setResetPasswordError('Ce mot de passe a déjà été utilisé récemment par cet utilisateur.')
    } else {
      setResetPasswordError('Échec de la réinitialisation.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const result = await apiCall('DELETE', `/staff/users/${deleteTarget.id}`, { staffToken })
    setDeleting(false)
    if (result.ok) {
      showToast('success', 'Utilisateur supprimé', deleteTarget.email)
      setDeleteTarget(null)
      reload()
    } else if (result.status === 409) {
      setDeleteError("L'utilisateur doit d'abord être désactivé.")
    } else {
      setDeleteError("Échec de la suppression.")
    }
  }

  return (
    <div>
      <PageHeader
        icon={<Users size={20} />}
        title="Utilisateurs"
        subtitle="Identifiants, tous organismes confondus"
        action={
          <PrimaryButton type="button" onClick={openCreate} className="px-3.5 py-2">
            <Plus size={15} />
            Nouvel utilisateur
          </PrimaryButton>
        }
      />

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
          <StaffTable headers={['Email', 'Nom', 'Organisme', 'Rôle', 'Statut', 'Dernière connexion', '']}>
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
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setResetTarget(u)
                        setResetPasswordValue('')
                        setResetPasswordError(null)
                      }}
                      className="px-2.5 py-1 text-xs"
                    >
                      <KeyRound size={12} />
                      Mot de passe
                    </SecondaryButton>
                    {u.status === 'active' ? (
                      <DangerButton
                        type="button"
                        onClick={() => toggleStatus(u)}
                        disabled={togglingId === u.id}
                        className="px-2.5 py-1 text-xs"
                      >
                        {togglingId === u.id ? '…' : 'Désactiver'}
                      </DangerButton>
                    ) : (
                      <>
                        <SecondaryButton
                          type="button"
                          onClick={() => toggleStatus(u)}
                          disabled={togglingId === u.id}
                          className="px-2.5 py-1 text-xs"
                        >
                          {togglingId === u.id ? '…' : 'Réactiver'}
                        </SecondaryButton>
                        <DangerButton
                          type="button"
                          onClick={() => {
                            setDeleteTarget(u)
                            setDeleteError(null)
                          }}
                          className="px-2.5 py-1 text-xs"
                        >
                          Supprimer
                        </DangerButton>
                      </>
                    )}
                  </div>
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
        <Modal title="Nouvel utilisateur" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Organisme</label>
              <SelectInput
                value={createOrgId}
                onChange={(e) => {
                  setCreateOrgId(e.target.value)
                  setCreateServiceIds([])
                }}
                required
              >
                <option value="">Choisir…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div className="flex gap-3">
              <TextInput
                placeholder="Prénom"
                value={createFirstName}
                onChange={(e) => setCreateFirstName(e.target.value)}
                required
              />
              <TextInput
                placeholder="Nom"
                value={createLastName}
                onChange={(e) => setCreateLastName(e.target.value)}
                required
              />
            </div>
            <TextInput
              type="email"
              placeholder="Email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
            />
            <TextInput
              type="password"
              placeholder="Mot de passe"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              required
              minLength={6}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rôle</label>
              <SelectInput value={createRole} onChange={(e) => setCreateRole(e.target.value as 'agent' | 'admin')}>
                <option value="agent">Agent</option>
                <option value="admin">Administrateur</option>
              </SelectInput>
            </div>

            {createRole === 'agent' && createOrgId && (
              <>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-gray-700">Services</p>
                  {createOrgServices === null ? (
                    <p className="text-sm text-gray-400">Chargement…</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {createOrgServices.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={createServiceIds.includes(s.id)}
                            onChange={(e) =>
                              setCreateServiceIds((prev) =>
                                e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                              )
                            }
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {relevantCreateLabels.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-gray-700">Permissions</p>
                    <div className="grid grid-cols-2 gap-2">
                      {relevantCreateLabels.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={createPermissions[key]}
                            onChange={(e) =>
                              setCreatePermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <PrimaryButton type="submit" disabled={creating} className="w-full">
              {creating ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title="Réinitialiser le mot de passe" onClose={() => setResetTarget(null)}>
          <p className="mb-3 text-sm text-gray-500">
            <strong>{resetTarget.email}</strong> devra choisir un nouveau mot de passe à sa
            prochaine connexion.
          </p>
          <form onSubmit={handleResetPassword} className="space-y-3">
            <TextInput
              type="password"
              placeholder="Nouveau mot de passe"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              required
              minLength={6}
            />
            {resetPasswordError && <p className="text-sm text-red-600">{resetPasswordError}</p>}
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                onClick={() => setResetTarget(null)}
                className="flex-1 justify-center"
              >
                Annuler
              </SecondaryButton>
              <DangerButton
                type="submit"
                disabled={resettingPassword}
                className="flex-1 justify-center py-2"
              >
                {resettingPassword ? 'Réinitialisation…' : 'Réinitialiser'}
              </DangerButton>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Supprimer l'utilisateur" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-gray-600">
            <strong>{deleteTarget.email}</strong> sera supprimé définitivement. Cette action est
            irréversible.
          </p>
          {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-2">
            <DangerButton
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 justify-center py-2"
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </DangerButton>
            <SecondaryButton
              type="button"
              onClick={() => setDeleteTarget(null)}
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

export default StaffUsersPage
