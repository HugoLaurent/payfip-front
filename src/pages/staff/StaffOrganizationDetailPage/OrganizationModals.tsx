import { DangerButton, Modal, PrimaryButton, SecondaryButton, SelectInput, Textarea, TextInput } from '@/components/ui'
import type { StaffOrganization } from '@/lib/types'

export function SuspendModal({
  org,
  suspendMessage,
  onChangeSuspendMessage,
  suspending,
  onConfirm,
  onClose,
}: {
  org: StaffOrganization
  suspendMessage: string
  onChangeSuspendMessage: (value: string) => void
  suspending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title="Suspendre l'organisme" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-600">
        Tous les administrateurs et agents de <strong>{org.name}</strong> seront déconnectés et ne
        pourront plus se reconnecter. Leurs services publics afficheront "fermé" aux citoyens. Vous
        pourrez réactiver l'organisme à tout moment.
      </p>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Message affiché en interne (optionnel)</label>
        <Textarea
          value={suspendMessage}
          onChange={(e) => onChangeSuspendMessage(e.target.value)}
          placeholder="Ex. impayé, contactez la facturation"
          rows={3}
          maxLength={300}
        />
      </div>
      <div className="flex gap-2">
        <DangerButton type="button" onClick={onConfirm} disabled={suspending} className="flex-1 justify-center py-2">
          {suspending ? 'Suspension…' : 'Suspendre'}
        </DangerButton>
        <SecondaryButton type="button" onClick={onClose} className="flex-1 justify-center">
          Annuler
        </SecondaryButton>
      </div>
    </Modal>
  )
}

// Suppression logique (status: 'deleted') — jamais de retour arrière
// possible via l'API une fois fait (voir organizations_controller.ts
// côté svc-auth), donc une friction volontaire en plus de la
// confirmation de la modale : il faut retaper le nom exact de
// l'organisme pour activer le bouton.
export function DeleteOrgModal({
  org,
  deleteConfirmName,
  onChangeDeleteConfirmName,
  deleting,
  onConfirm,
  onClose,
}: {
  org: StaffOrganization
  deleteConfirmName: string
  onChangeDeleteConfirmName: (value: string) => void
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title="Supprimer l'organisme" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-600">
        <strong>{org.name}</strong> et tous ses services deviendront définitivement
        inaccessibles (public, admins, agents). Aucune base de données n'est supprimée
        automatiquement — c'est une suppression logique, mais irréversible depuis cette
        interface. Tapez le nom exact de l'organisme pour confirmer.
      </p>
      <TextInput
        value={deleteConfirmName}
        onChange={(e) => onChangeDeleteConfirmName(e.target.value)}
        placeholder={org.name}
        className="mb-4"
      />
      <div className="flex gap-2">
        <DangerButton
          type="button"
          onClick={onConfirm}
          disabled={deleting || deleteConfirmName !== org.name}
          className="flex-1 justify-center py-2"
        >
          {deleting ? 'Suppression…' : "Supprimer définitivement"}
        </DangerButton>
        <SecondaryButton type="button" onClick={onClose} className="flex-1 justify-center">
          Annuler
        </SecondaryButton>
      </div>
    </Modal>
  )
}

export function CreateServiceModal({
  serviceName,
  onChangeServiceName,
  serviceType,
  onChangeServiceType,
  numcli,
  onChangeNumcli,
  createServiceError,
  creatingService,
  onSubmit,
  onClose,
}: {
  serviceName: string
  onChangeServiceName: (value: string) => void
  serviceType: 'billetterie' | 'factures'
  onChangeServiceType: (value: 'billetterie' | 'factures') => void
  numcli: string
  onChangeNumcli: (value: string) => void
  createServiceError: string | null
  creatingService: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal title="Nouveau service" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nom du service</label>
          <TextInput value={serviceName} onChange={(e) => onChangeServiceName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
          <SelectInput
            value={serviceType}
            onChange={(e) => onChangeServiceType(e.target.value as 'billetterie' | 'factures')}
          >
            <option value="billetterie">Billetterie</option>
            <option value="factures">Facture</option>
          </SelectInput>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Numéro client PayFiP</label>
          <TextInput value={numcli} onChange={(e) => onChangeNumcli(e.target.value)} placeholder="6 chiffres" required />
        </div>
        {createServiceError && <p className="text-sm text-red-600">{createServiceError}</p>}
        <PrimaryButton type="submit" disabled={creatingService} className="w-full">
          {creatingService ? 'Création…' : 'Créer'}
        </PrimaryButton>
      </form>
    </Modal>
  )
}
