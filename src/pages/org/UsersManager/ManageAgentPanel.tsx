import { KeyRound, Users as UsersIcon } from 'lucide-react'
import { Card, DangerButton, Modal, PageHeader, PrimaryButton, SecondaryButton, TextInput } from '@/components/ui'
import type { AgentPermissions } from '@/lib/types'
import { agentName } from './agentHelpers'
import { getPermissionLabels } from './permissions'
import type { Agent } from './types'

// Vue de détail d'un agent/admin — statut, mot de passe, nom, permissions
// par service (ou message générique si admin, accès complet sans
// permission à configurer). Remplace la liste tant que manageAgent est
// sélectionné, voir UsersManager/index.tsx.
export function ManageAgentPanel({
  manageAgent,
  managingSelf,
  editFirstName,
  onChangeFirstName,
  editLastName,
  onChangeLastName,
  editPermissions,
  onChangePermission,
  statusUpdating,
  statusError,
  onUpdateStatus,
  savingPermissions,
  onSave,
  onCancel,
  showDeleteConfirm,
  onRequestDelete,
  onCloseDeleteConfirm,
  deleting,
  deleteError,
  onConfirmDelete,
  showResetPasswordModal,
  onRequestResetPassword,
  onCloseResetPasswordModal,
  resetPasswordValue,
  onChangeResetPasswordValue,
  resettingPassword,
  resetPasswordError,
  resetPasswordSuccess,
  onSubmitResetPassword,
}: {
  manageAgent: Agent
  managingSelf: boolean
  editFirstName: string
  onChangeFirstName: (value: string) => void
  editLastName: string
  onChangeLastName: (value: string) => void
  editPermissions: Record<number, AgentPermissions>
  onChangePermission: (serviceId: number, key: keyof AgentPermissions, checked: boolean) => void
  statusUpdating: boolean
  statusError: string | null
  onUpdateStatus: (status: 'active' | 'inactive') => void
  savingPermissions: boolean
  onSave: () => void
  onCancel: () => void
  showDeleteConfirm: boolean
  onRequestDelete: () => void
  onCloseDeleteConfirm: () => void
  deleting: boolean
  deleteError: string | null
  onConfirmDelete: () => void
  showResetPasswordModal: boolean
  onRequestResetPassword: () => void
  onCloseResetPasswordModal: () => void
  resetPasswordValue: string
  onChangeResetPasswordValue: (value: string) => void
  resettingPassword: boolean
  resetPasswordError: string | null
  resetPasswordSuccess: boolean
  onSubmitResetPassword: (e: React.FormEvent) => void
}) {
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
                  onClick={() => onUpdateStatus('inactive')}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? '…' : 'Désactiver'}
                </DangerButton>
              ) : (
                <>
                  <SecondaryButton
                    type="button"
                    onClick={() => onUpdateStatus('active')}
                    disabled={statusUpdating}
                  >
                    {statusUpdating ? '…' : 'Réactiver'}
                  </SecondaryButton>
                  <DangerButton type="button" onClick={onRequestDelete}>
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
            <SecondaryButton type="button" onClick={onRequestResetPassword}>
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
            onChange={(e) => onChangeFirstName(e.target.value)}
          />
          <TextInput
            placeholder="Nom"
            value={editLastName}
            onChange={(e) => onChangeLastName(e.target.value)}
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
            <PrimaryButton onClick={onSave} disabled={savingPermissions}>
              {savingPermissions ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <SecondaryButton onClick={onCancel}>Annuler</SecondaryButton>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4">
          {manageAgent.services.map((s) => {
            const labels = getPermissionLabels(s.serviceType)
            return (
              <div key={s.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                <p className="mb-2 text-sm font-medium text-gray-700">{s.name}</p>
                {labels.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    Ce service n'a pas de permission spécifique pour l'instant.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {labels.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={editPermissions[s.id]?.[key] ?? false}
                          onChange={(e) => onChangePermission(s.id, key, e.target.checked)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex gap-2 pt-2">
            <PrimaryButton onClick={onSave} disabled={savingPermissions}>
              {savingPermissions ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <SecondaryButton onClick={onCancel}>Annuler</SecondaryButton>
          </div>
        </Card>
      )}

      {showDeleteConfirm && (
        <Modal title="Supprimer l'utilisateur" onClose={onCloseDeleteConfirm}>
          <p className="mb-4 text-sm text-gray-600">
            <strong>{agentName(manageAgent) ?? manageAgent.email}</strong> sera supprimé
            définitivement. Cette action est irréversible.
          </p>
          {deleteError && <p className="mb-3 text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-2">
            <DangerButton
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="flex-1 justify-center py-2"
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </DangerButton>
            <SecondaryButton
              type="button"
              onClick={onCloseDeleteConfirm}
              className="flex-1 justify-center"
            >
              Annuler
            </SecondaryButton>
          </div>
        </Modal>
      )}

      {showResetPasswordModal && (
        <Modal title="Réinitialiser le mot de passe" onClose={onCloseResetPasswordModal}>
          <form onSubmit={onSubmitResetPassword} className="space-y-3">
            <p className="text-sm text-gray-600">
              <strong>{agentName(manageAgent) ?? manageAgent.email}</strong> devra choisir un
              nouveau mot de passe à sa prochaine connexion.
            </p>
            <TextInput
              type="password"
              placeholder="Nouveau mot de passe"
              value={resetPasswordValue}
              onChange={(e) => onChangeResetPasswordValue(e.target.value)}
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
