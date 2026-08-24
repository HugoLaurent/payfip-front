import { useState } from 'react'
import { ChevronRight, KeyRound, Plus, Search, Users as UsersIcon } from 'lucide-react'
import { apiCall } from '@/lib/api'
import {
  Card,
  DangerButton,
  EmptyState,
  LoadError,
  Modal,
  PageHeader,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import { UserFormModal } from './UserFormModal'
import { PERMISSION_LABELS } from './permissions'
import type { AgentPermissions, PageMeta } from '@/lib/types'

const PER_PAGE = 10

interface AgentServiceLink {
  id: number
  name: string
  permissions: AgentPermissions
}

interface Agent {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  role: 'admin' | 'agent'
  lastLoginAt: string | null
  services: AgentServiceLink[]
}

function agentName(agent: Agent): string | null {
  if (!agent.firstName && !agent.lastName) return null
  return [agent.firstName, agent.lastName].filter(Boolean).join(' ')
}

function agentInitials(agent: Agent): string {
  const name = agentName(agent)
  if (!name) return agent.email.slice(0, 2).toUpperCase()
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Jamais connecté'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "Connecté à l'instant"
  if (diffMin < 60) return `Connecté il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Connecté il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `Connecté il y a ${diffD} j`
  return `Dernière connexion le ${new Date(iso).toLocaleDateString('fr-FR')}`
}

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

  async function saveAgentPermissions() {
    if (manageAgentId === null || !editPermissions) return
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
      showToast('success', 'Utilisateur mis à jour', agentName(manageAgent!) ?? manageAgent!.email)
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer les modifications.")
    }
    await loadAgents()
  }

  async function updateAgentStatus(status: 'active' | 'inactive') {
    if (manageAgentId === null || !editPermissions) return
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
        agentName(manageAgent!) ?? manageAgent!.email
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
    if (manageAgentId === null) return
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
      showToast('success', 'Mot de passe réinitialisé', agentName(manageAgent!) ?? manageAgent!.email)
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
      <div>
        <PageHeader
          icon={<UsersIcon size={20} />}
          title={agentName(manageAgent) ?? manageAgent.email}
          subtitle={
            manageAgent.role === 'admin'
              ? `${manageAgent.email} · Administrateur`
              : agentName(manageAgent)
                ? `${manageAgent.email} · Permissions par service`
                : 'Permissions par service'
          }
        />

        {managingSelf ? (
          <Card className="mb-4">
            <p className="text-sm text-gray-500">
              C'est votre propre compte — utilisez « Mon profil » (en haut de la barre latérale)
              pour changer votre nom ou votre mot de passe.
            </p>
          </Card>
        ) : (
          <>
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Statut</p>
                <p className="text-sm text-gray-500">
                  {manageAgent.status === 'active'
                    ? 'Actif — peut se connecter'
                    : 'Désactivé — connexion bloquée'}
                </p>
                {statusError && <p className="mt-1 text-sm text-red-600">{statusError}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {manageAgent.status === 'active' ? (
                  <DangerButton
                    type="button"
                    onClick={() => updateAgentStatus('inactive')}
                    disabled={statusUpdating}
                  >
                    {statusUpdating ? '…' : 'Désactiver'}
                  </DangerButton>
                ) : (
                  <>
                    <SecondaryButton
                      type="button"
                      onClick={() => updateAgentStatus('active')}
                      disabled={statusUpdating}
                    >
                      {statusUpdating ? '…' : 'Réactiver'}
                    </SecondaryButton>
                    <DangerButton type="button" onClick={() => setShowDeleteConfirm(true)}>
                      Supprimer
                    </DangerButton>
                  </>
                )}
              </div>
            </Card>

            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Mot de passe</p>
                <p className="text-sm text-gray-500">
                  Devra en choisir un nouveau à sa prochaine connexion.
                </p>
              </div>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setResetPasswordValue('')
                  setResetPasswordError(null)
                  setResetPasswordSuccess(false)
                  setShowResetPasswordModal(true)
                }}
              >
                <KeyRound size={14} />
                Réinitialiser
              </SecondaryButton>
            </Card>
          </>
        )}

        <Card className="mb-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Nom</p>
          <div className="flex gap-3">
            <TextInput
              placeholder="Prénom"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
            />
            <TextInput
              placeholder="Nom"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
            />
          </div>
        </Card>

        {manageAgent.role === 'admin' ? (
          <Card>
            <p className="text-sm text-gray-500">
              Un administrateur a un accès complet à tout l'organisme — aucune permission par
              service à configurer.
            </p>
            <div className="flex gap-2 pt-3">
              <PrimaryButton onClick={saveAgentPermissions} disabled={savingPermissions}>
                {savingPermissions ? 'Enregistrement…' : 'Enregistrer'}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setManageAgentId(null)
                  setEditPermissions(null)
                }}
              >
                Annuler
              </SecondaryButton>
            </div>
          </Card>
        ) : (
        <Card className="space-y-4">
          {manageAgent.services.map((s) => (
            <div key={s.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
              <p className="mb-2 text-sm font-medium text-gray-700">{s.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={editPermissions[s.id]?.[key] ?? false}
                      onChange={(e) =>
                        setEditPermissions((prev) => ({
                          ...prev,
                          [s.id]: { ...prev![s.id], [key]: e.target.checked },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <PrimaryButton onClick={saveAgentPermissions} disabled={savingPermissions}>
              {savingPermissions ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setManageAgentId(null)
                setEditPermissions(null)
              }}
            >
              Annuler
            </SecondaryButton>
          </div>
        </Card>
        )}

        {showDeleteConfirm && (
          <Modal title="Supprimer l'utilisateur" onClose={() => setShowDeleteConfirm(false)}>
            <p className="mb-4 text-sm text-gray-600">
              <strong>{agentName(manageAgent) ?? manageAgent.email}</strong> sera supprimé
              définitivement. Cette action est irréversible.
            </p>
            {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <DangerButton
                type="button"
                onClick={handleDeleteAgent}
                disabled={deleting}
                className="flex-1 justify-center py-2"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </DangerButton>
              <SecondaryButton
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 justify-center"
              >
                Annuler
              </SecondaryButton>
            </div>
          </Modal>
        )}

        {showResetPasswordModal && (
          <Modal title="Réinitialiser le mot de passe" onClose={() => setShowResetPasswordModal(false)}>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <p className="text-sm text-gray-600">
                <strong>{agentName(manageAgent) ?? manageAgent.email}</strong> devra choisir un
                nouveau mot de passe à sa prochaine connexion.
              </p>
              <TextInput
                type="password"
                placeholder="Nouveau mot de passe"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                required
                minLength={6}
              />
              {resetPasswordError && <p className="text-sm text-red-600">{resetPasswordError}</p>}
              {resetPasswordSuccess && (
                <p className="text-sm text-emerald-600">Mot de passe réinitialisé.</p>
              )}
              <PrimaryButton type="submit" disabled={resettingPassword} className="w-full">
                {resettingPassword ? 'Réinitialisation…' : 'Réinitialiser'}
              </PrimaryButton>
            </form>
          </Modal>
        )}
      </div>
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
        {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && agents?.length === 0 && (
          <EmptyState
            icon={<UsersIcon size={28} />}
            label={tab === 'admins' ? 'Aucun administrateur pour l\'instant.' : 'Aucun agent pour l\'instant.'}
          />
        )}
        {agents?.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => selectManageAgent(agent)}
            className="flex w-full items-center gap-3 squircle rounded-2xl bg-white p-4 text-left shadow-[0_1px_3px_rgba(20,25,60,0.06)] transition-shadow hover:shadow-md"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                agent.status === 'inactive'
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-aregie-deep/10 text-aregie-deep'
              }`}
            >
              {agentInitials(agent)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">
                  {agentName(agent) ?? agent.email}
                  {agent.id === auth.userId && ' (vous)'}
                </p>
                {agent.status === 'inactive' && (
                  <StatusBadge label="Désactivé" className="bg-gray-100 text-gray-500" />
                )}
              </div>
              <p className="truncate text-sm text-gray-500">
                {agentName(agent) ? `${agent.email} · ` : ''}
                {tab === 'agents' &&
                  `${agent.services.map((s) => s.name).join(', ') || 'Aucun service'} · `}
                {formatLastLogin(agent.lastLoginAt)}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gray-400" />
          </button>
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
