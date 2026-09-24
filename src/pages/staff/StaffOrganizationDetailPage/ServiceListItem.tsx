import { Check, Settings, X } from 'lucide-react'
import { DangerButton, SecondaryButton, StatusBadge, TextInput } from '@/components/ui'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { ServiceRow } from '@/lib/types'

// Une ligne de service dans la fiche organisme — nom/type/n° client à
// gauche, statut + actions à droite, plus une seconde ligne pour le lien
// public (slug), éditable inline. Le lien public est staff-only — jamais
// éditable par l'organisme, même un admin (voir ServicesController#update
// côté back).
export function ServiceListItem({
  service,
  suspended,
  togglingServiceId,
  onToggleService,
  onManage,
  editingSlugId,
  slugInput,
  slugError,
  savingSlug,
  onStartEditSlug,
  onChangeSlugInput,
  onSaveSlug,
  onCancelEditSlug,
}: {
  service: ServiceRow
  suspended: boolean
  togglingServiceId: number | null
  onToggleService: (service: ServiceRow) => void
  onManage: (service: ServiceRow) => void
  editingSlugId: number | null
  slugInput: string
  slugError: string | null
  savingSlug: boolean
  onStartEditSlug: (service: ServiceRow) => void
  onChangeSlugInput: (value: string) => void
  onSaveSlug: (service: ServiceRow) => void
  onCancelEditSlug: () => void
}) {
  const s = service
  return (
    <div className="flex flex-col gap-2 border-b border-gray-50 py-3 last:border-0">
      <div className="flex items-center gap-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-gray-900">{s.name}</p>
          <p className="text-xs text-gray-400">
            {SERVICE_TYPE_LABELS[s.serviceType] ?? s.serviceType}
            {s.numcli && ` · Client PayFiP n° ${s.numcli}`}
            {s.linkCode && (
              <>
                {' · Code de liaison AREGIE '}
                <span className="select-all font-mono text-gray-500">{s.linkCode}</span>
              </>
            )}
          </p>
        </div>
        {suspended ? (
          <StatusBadge label="Fermé (organisme)" className="bg-red-100 text-red-600" />
        ) : (
          <>
            <StatusBadge
              label={SERVICE_STATUS_LABELS[s.status] ?? s.status}
              className={SERVICE_STATUS_TINTS[s.status] ?? 'bg-gray-100 text-gray-600'}
            />
            {s.status === 'active' ? (
              <DangerButton
                type="button"
                onClick={() => onToggleService(s)}
                disabled={togglingServiceId === s.id}
                className="px-3 py-1.5"
              >
                {togglingServiceId === s.id ? '…' : 'Fermer'}
              </DangerButton>
            ) : (
              <SecondaryButton
                type="button"
                onClick={() => onToggleService(s)}
                disabled={togglingServiceId === s.id}
                className="px-3 py-1.5"
              >
                {togglingServiceId === s.id ? '…' : 'Réactiver'}
              </SecondaryButton>
            )}
          </>
        )}
        <SecondaryButton type="button" onClick={() => onManage(s)} className="px-3 py-1.5">
          <Settings size={13} />
          Gérer
        </SecondaryButton>
      </div>

      {editingSlugId === s.id ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
          <span className="shrink-0 text-xs text-gray-400">/{s.serviceType}/</span>
          <TextInput
            value={slugInput}
            onChange={(e) => onChangeSlugInput(e.target.value.toLowerCase())}
            placeholder="mon-service"
            autoFocus
            className="max-w-[200px] py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => onSaveSlug(s)}
            disabled={savingSlug}
            className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 disabled:opacity-50"
            aria-label="Enregistrer le lien"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            onClick={onCancelEditSlug}
            className="squircle flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
            aria-label="Annuler la modification du lien"
          >
            <X size={13} />
          </button>
          {slugError && <p className="w-full text-xs text-red-600">{slugError}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2 pl-0.5">
          <span className="text-xs text-gray-400">
            {s.slug ? `/${s.serviceType}/${s.slug}` : 'Aucun lien public'}
          </span>
          <button
            type="button"
            onClick={() => onStartEditSlug(s)}
            className="text-xs font-semibold text-aregie-blue"
          >
            Modifier
          </button>
        </div>
      )}
    </div>
  )
}
