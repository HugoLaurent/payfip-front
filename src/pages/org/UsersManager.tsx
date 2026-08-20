import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
  TextInput,
} from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { AgentPermissions, AuthState, PageMeta } from '@/lib/types'

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

const PERMISSION_LABELS: { key: keyof AgentPermissions; label: string }[] = [
  { key: 'canSell', label: 'Vendre des billets' },
  { key: 'canScan', label: 'Scanner les billets' },
  { key: 'canManageTariffs', label: 'Gérer les tarifs' },
  { key: 'canViewHistory', label: "Voir l'historique" },
  { key: 'canToggleService', label: 'Fermer les ventes' },
]

const DEFAULT_PERMISSIONS: AgentPermissions = {
  canSell: true,
  canScan: true,
  canManageTariffs: false,
  canViewHistory: true,
  canToggleService: false,
}

export function UsersManager({ auth }: { auth: AuthState }) {
  const [tab, setTab] = useState<'agents' | 'admins'>('agents')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const showLoading = useDelayedLoading(agents === null)
  const [meta, setMeta] = useState<PageMeta | null>(null)
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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [permissions, setPermissions] = useState<AgentPermissions>(DEFAULT_PERMISSIONS)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  async function loadAgents() {
    setLoadFailed(false)
    const roleParam = tab === 'admins' ? 'admin' : 'agent'
    const result = await apiCall<{ data: Agent[]; meta: PageMeta }>(
      'GET',
      `/auth/users?role=${roleParam}&q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`,
      { token: auth.token }
    )
    if (result.ok) {
      setAgents(result.data.data)
      setMeta(result.data.meta)
    } else {
      setLoadFailed(true)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadAgents, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, tab, q, page])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (serviceIds.length === 0) {
      setError('Choisissez au moins un service.')
      return
    }

    setCreating(true)
    setError(null)

    const result = await apiCall('POST', '/auth/users', {
      token: auth.token,
      body: { firstName, lastName, email, password, serviceIds, ...permissions },
    })

    setCreating(false)

    if (result.ok) {
      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setServiceIds([])
      setPermissions(DEFAULT_PERMISSIONS)
      setShowCreateModal(false)
      await loadAgents()
    } else if (result.status === 409) {
      setError('Cet email est déjà utilisé.')
    } else if (result.status === 422) {
      setError("Un des services choisis n'appartient pas à votre organisme.")
    } else {
      setError('Échec de la création.')
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)

    const result = await apiCall('POST', '/auth/users', {
      token: auth.token,
      body: { firstName, lastName, email, password, role: 'admin' },
    })

    setCreating(false)

    if (result.ok) {
      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setShowCreateModal(false)
      await loadAgents()
    } else if (result.status === 409) {
      setError('Cet email est déjà utilisé.')
    } else {
      setError('Échec de la création.')
    }
  }

  function selectManageAgent(agent: Agent) {
    setManageAgentId(agent.id)
    setEditPermissions(Object.fromEntries(agent.services.map((s) => [s.id, s.permissions])))
    setEditFirstName(agent.firstName ?? '')
    setEditLastName(agent.lastName ?? '')
  }

  async function saveAgentPermissions() {
    if (manageAgentId === null || !editPermissions) return
    setSavingPermissions(true)
    await apiCall('PATCH', `/auth/users/${manageAgentId}`, {
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
      await loadAgents()
    } else if (result.status === 409) {
      setStatusError("Impossible : c'est le dernier administrateur actif de l'organisme.")
    } else {
      setStatusError('Échec de la mise à jour.')
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
    } else if (result.status === 422) {
      setResetPasswordError('Ce mot de passe a déjà été utilisé récemment par cet utilisateur.')
    } else {
      setResetPasswordError('Échec de la réinitialisation.')
    }
  }

  async function handleDeleteAgent() {
    if (manageAgentId === null) return
    setDeleting(true)
    setDeleteError(null)
    const result = await apiCall('DELETE', `/auth/users/${manageAgentId}`, { token: auth.token })
    setDeleting(false)
    if (result.ok) {
      setShowDeleteConfirm(false)
      setManageAgentId(null)
      setEditPermissions(null)
      await loadAgents()
    } else if (result.status === 409) {
      setDeleteError("L'agent doit d'abord être désactivé.")
    } else {
      setDeleteError('Échec de la suppression.')
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
          <PrimaryButton
            type="button"
            onClick={() => {
              setFirstName('')
              setLastName('')
              setEmail('')
              setPassword('')
              setServiceIds([])
              setPermissions(DEFAULT_PERMISSIONS)
              setError(null)
              setShowCreateModal(true)
            }}
          >
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
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
          <motion.button
            key={agent.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => selectManageAgent(agent)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition-shadow hover:ring-aregie-blue/40"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {agentName(agent) ?? agent.email}
                  {agent.id === auth.userId && ' (vous)'}
                </p>
                {agent.status === 'inactive' && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                    Désactivé
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {agentName(agent) ? `${agent.email} · ` : ''}
                {tab === 'agents' &&
                  `${agent.services.map((s) => s.name).join(', ') || 'Aucun service'} · `}
                {formatLastLogin(agent.lastLoginAt)}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </motion.button>
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

      {showCreateModal && tab === 'agents' && (
        <Modal title="Nouvel agent" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex gap-3">
              <TextInput
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <TextInput
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <TextInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextInput
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-xs text-gray-400">
              Devra choisir son propre mot de passe à sa première connexion.
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Services</p>
              <div className="flex flex-wrap gap-3">
                {auth.services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(s.id)}
                      onChange={(e) =>
                        setServiceIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={(e) =>
                        setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <PrimaryButton type="submit" disabled={creating} className="w-full">
              {creating ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {showCreateModal && tab === 'admins' && (
        <Modal title="Nouvel administrateur" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <div className="flex gap-3">
              <TextInput
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <TextInput
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <TextInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextInput
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <p className="text-xs text-gray-400">
              Un administrateur a un accès complet à l'organisme et devra choisir son propre mot
              de passe à sa première connexion.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <PrimaryButton type="submit" disabled={creating} className="w-full">
              {creating ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
