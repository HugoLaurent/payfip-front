import { useEffect, useState } from 'react'
import { KeyRound, Search, Users } from 'lucide-react'
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
  SecondaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
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
