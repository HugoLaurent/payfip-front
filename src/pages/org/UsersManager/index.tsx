import { useState } from 'react'
import { ChevronRight, Plus, Search, Users as UsersIcon } from 'lucide-react'
import { apiCall } from '@/lib/api'
import {
  Card,
  EmptyState,
  ListRow,
  ListRowSkeleton,
  LoadError,
  PageHeader,
  Pagination,
  PrimaryButton,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import { UserFormModal } from './UserFormModal'
import { ManageAgentPanel } from './ManageAgentPanel'
import { agentInitials, agentName, formatLastLogin } from './agentHelpers'
import type { Agent } from './types'
import type { AgentPermissions, PageMeta } from '@/lib/types'

const PER_PAGE = 10

export function UsersManager() {
  const { auth } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState<'agents' | 'admins'>('agents')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const {
    data: agents,
    meta,
    loadFailed,
    showLoading,
    reload: loadAgents,
  } = usePaginatedResource<Agent, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/auth/users?role=${tab === 'admins' ? 'admin' : 'agent'}&q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`,
        { token: auth.token }
      ),
    deps: [auth.token, tab, q, page],
  })
  const [manageAgentId, setManageAgentId] = useState<number | null>(null)
  const [editPermissions, setEditPermissions] = useState<Record<number, AgentPermissions> | null>(
    null
  )
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false)

  function selectManageAgent(agent: Agent) {
    setManageAgentId(agent.id)
    setEditPermissions(Object.fromEntries(agent.services.map((s) => [s.id, s.permissions])))
    setEditFirstName(agent.firstName ?? '')
    setEditLastName(agent.lastName ?? '')
  }

  function changePermission(serviceId: number, key: keyof AgentPermissions, checked: boolean) {
    setEditPermissions((prev) => ({
      ...prev,
      [serviceId]: { ...prev![serviceId], [key]: checked },
    }))
  }

  async function saveAgentPermissions() {
    if (manageAgentId === null || !editPermissions || !manageAgent) return
    setSavingPermissions(true)
    const result = await apiCall('PATCH', `/auth/users/${manageAgentId}`, {
      token: auth.token,
      body: {
        // Le validateur rejette une chaîne vide — on n'envoie le champ
        // que s'il a une valeur, pour ne pas faire échouer tout le
        // PATCH (permissions incluses) quand l'agent n'a pas encore de
        // nom renseigné et que l'admin n'y touche pas.
        ...(editFirstName.trim() ? { firstName: editFirstName.trim() } : {}),
        ...(editLastName.trim() ? { lastName: editLastName.trim() } : {}),
        services: Object.entries(editPermissions).map(([serviceId, perms]) => ({
          serviceId: Number(serviceId),
          ...perms,
        })),
      },
    })
    setSavingPermissions(false)
    setManageAgentId(null)
    setEditPermissions(null)
    if (result.ok) {
      showToast('success', 'Utilisateur mis à jour', agentName(manageAgent) ?? manageAgent.email)
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer les modifications.")
    }
    await loadAgents()
  }

  async function updateAgentStatus(status: 'active' | 'inactive') {
    if (manageAgentId === null || !editPermissions || !manageAgent) return
    setStatusUpdating(true)
    setStatusError(null)
    const result = await apiCall('PATCH', `/auth/users/${manageAgentId}`, {
      token: auth.token,
      body: {
        status,
        services: Object.entries(editPermissions).map(([serviceId, perms]) => ({
          serviceId: Number(serviceId),
          ...perms,
        })),
      },
    })
    setStatusUpdating(false)
    if (result.ok) {
      showToast(
        'success',
        status === 'active' ? 'Utilisateur réactivé' : 'Utilisateur désactivé',
        agentName(manageAgent) ?? manageAgent.email
      )
      await loadAgents()
    } else if (result.status === 409) {
      setStatusError("Impossible : c'est le dernier administrateur actif de l'organisme.")
      showToast('error', 'Échec', "C'est le dernier administrateur actif de l'organisme.")
    } else {
      setStatusError('Échec de la mise à jour.')
      showToast('error', 'Échec', 'Impossible de mettre à jour le statut.')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (manageAgentId === null || !manageAgent) return
    setResettingPassword(true)
    setResetPasswordError(null)
    setResetPasswordSuccess(false)

    const result = await apiCall('PATCH', `/auth/users/${manageAgentId}/password`, {
      token: auth.token,
      body: { newPassword: resetPasswordValue },
    })

    setResettingPassword(false)

    if (result.ok) {
      setResetPasswordValue('')
      setResetPasswordSuccess(true)
      showToast('success', 'Mot de passe réinitialisé', agentName(manageAgent) ?? manageAgent.email)
    } else if (result.status === 422) {
      setResetPasswordError('Ce mot de passe a déjà été utilisé récemment par cet utilisateur.')
      showToast('error', 'Échec', 'Ce mot de passe a déjà été utilisé récemment.')
    } else {
      setResetPasswordError('Échec de la réinitialisation.')
      showToast('error', 'Échec', 'Impossible de réinitialiser le mot de passe.')
    }
  }

  async function handleDeleteAgent() {
    if (manageAgentId === null) return
    const deletedName = manageAgent ? (agentName(manageAgent) ?? manageAgent.email) : ''
    setDeleting(true)
    setDeleteError(null)
    const result = await apiCall('DELETE', `/auth/users/${manageAgentId}`, { token: auth.token })
    setDeleting(false)
    if (result.ok) {
      setShowDeleteConfirm(false)
      setManageAgentId(null)
      setEditPermissions(null)
      showToast('success', 'Utilisateur supprimé', deletedName)
      await loadAgents()
    } else if (result.status === 409) {
      setDeleteError("L'agent doit d'abord être désactivé.")
      showToast('error', 'Échec', "L'agent doit d'abord être désactivé.")
    } else {
      setDeleteError('Échec de la suppression.')
      showToast('error', 'Échec', "Impossible de supprimer l'utilisateur.")
    }
  }

  const manageAgent = agents?.find((a) => a.id === manageAgentId) ?? null
  const managingSelf = manageAgent?.id === auth.userId

  if (manageAgent && editPermissions) {
    return (
      <ManageAgentPanel
        manageAgent={manageAgent}
        managingSelf={managingSelf}
        editFirstName={editFirstName}
        onChangeFirstName={setEditFirstName}
        editLastName={editLastName}
        onChangeLastName={setEditLastName}
        editPermissions={editPermissions}
        onChangePermission={changePermission}
        statusUpdating={statusUpdating}
        statusError={statusError}
        onUpdateStatus={updateAgentStatus}
        savingPermissions={savingPermissions}
        onSave={saveAgentPermissions}
        onCancel={() => {
          setManageAgentId(null)
          setEditPermissions(null)
        }}
        showDeleteConfirm={showDeleteConfirm}
        onRequestDelete={() => setShowDeleteConfirm(true)}
        onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
        deleting={deleting}
        deleteError={deleteError}
        onConfirmDelete={handleDeleteAgent}
        showResetPasswordModal={showResetPasswordModal}
        onRequestResetPassword={() => {
          setResetPasswordValue('')
          setResetPasswordError(null)
          setResetPasswordSuccess(false)
          setShowResetPasswordModal(true)
        }}
        onCloseResetPasswordModal={() => setShowResetPasswordModal(false)}
        resetPasswordValue={resetPasswordValue}
        onChangeResetPasswordValue={setResetPasswordValue}
        resettingPassword={resettingPassword}
        resetPasswordError={resetPasswordError}
        resetPasswordSuccess={resetPasswordSuccess}
        onSubmitResetPassword={handleResetPassword}
      />
    )
  }

  return (
    <div>
      <PageHeader
        icon={<UsersIcon size={20} />}
        title="Utilisateurs"
        subtitle={tab === 'admins' ? "Administrateurs de l'organisme" : "Agents de l'organisme"}
        action={
          <PrimaryButton type="button" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            {tab === 'admins' ? 'Ajouter un administrateur' : 'Ajouter un agent'}
          </PrimaryButton>
        }
      />

      <div className="mb-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setTab('agents')
            setPage(1)
          }}
          className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
            tab === 'agents' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Agents
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('admins')
            setPage(1)
          }}
          className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
            tab === 'admins' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Administrateurs
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder={tab === 'admins' ? 'Rechercher un administrateur…' : 'Rechercher un agent…'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <div className="mb-2 space-y-2">
        {loadFailed && <LoadError onRetry={loadAgents} />}
        {!loadFailed && showLoading && (
          <ListRowSkeleton iconWrapperClassName="h-9 w-9 rounded-full" trailingWidth={null} />
        )}
        {!loadFailed && !showLoading && agents?.length === 0 && (
          <EmptyState
            icon={<UsersIcon size={28} />}
            label={tab === 'admins' ? 'Aucun administrateur pour l\'instant.' : 'Aucun agent pour l\'instant.'}
          />
        )}
        {!showLoading && agents?.map((agent, i) => (
          <ListRow
            key={agent.id}
            index={i}
            onClick={() => selectManageAgent(agent)}
            iconWrapperClassName={`h-9 w-9 rounded-full text-[13px] font-bold ${
              agent.status === 'inactive'
                ? 'bg-gray-100 text-gray-400'
                : 'bg-aregie-deep/10 text-aregie-deep'
            }`}
            icon={agentInitials(agent)}
            title={
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">
                  {agentName(agent) ?? agent.email}
                  {agent.id === auth.userId && ' (vous)'}
                </p>
                {agent.status === 'inactive' && (
                  <StatusBadge label="Désactivé" className="bg-gray-100 text-gray-500" />
                )}
              </div>
            }
            subtitle={
              <p className="truncate text-sm text-gray-500">
                {agentName(agent) ? `${agent.email} · ` : ''}
                {tab === 'agents' &&
                  `${agent.services.map((s) => s.name).join(', ') || 'Aucun service'} · `}
                {formatLastLogin(agent.lastLoginAt)}
              </p>
            }
            trailing={<ChevronRight size={18} className="shrink-0 text-gray-400" />}
          />
        ))}
      </div>

      {meta && meta.lastPage > 1 && (
        <Card className="mb-6">
          <Pagination
            currentPage={meta.currentPage}
            lastPage={meta.lastPage}
            total={meta.total}
            onChange={setPage}
          />
        </Card>
      )}

      {showCreateModal && (
        <UserFormModal
          mode={tab === 'admins' ? 'admin' : 'agent'}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            loadAgents()
          }}
        />
      )}
    </div>
  )
}

export default UsersManager
