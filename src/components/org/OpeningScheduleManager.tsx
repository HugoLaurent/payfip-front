import { useState } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card, EmptyState, Modal, PrimaryButton, Switch, TextInput } from '@/components/ui'
import { useToast } from '@/lib/useToast'
import type { AuthState, ServiceClosure, ServiceRow } from '@/lib/types'

const WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 7, label: 'Dim' },
]

function formatDateFr(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Jours de fermeture hebdo (optionnels — sans eux, toujours ouvert) +
// périodes de fermeture ponctuelles (vacances, fermeture exceptionnelle…),
// même schéma CRUD que TariffsManager pour ces dernières : une vraie
// collection avec son propre id, pas un champ.
//
// Pas d'horaires (heure début/fin) : un billet correspond à une journée de
// visite entière, pas un créneau — jamais bloquer la PAGE d'achat par
// jour/heure courants (l'usager doit pouvoir acheter aujourd'hui un billet
// pour un jour ouvert plus tard), seulement empêcher de CHOISIR un jour
// fermé comme date de visite (voir PublicPurchasePage.tsx côté front,
// ServicesController#lookupBySlug + OrdersController#store côté back).
export function OpeningScheduleManager({
  auth,
  service,
  canManage,
  onServiceUpdate,
}: {
  auth: AuthState
  service: ServiceRow
  canManage: boolean
  onServiceUpdate: (patch: Partial<ServiceRow>) => void
}) {
  const { showToast } = useToast()
  const [enabled, setEnabled] = useState(service.openingDays !== null)
  const [days, setDays] = useState<number[]>(service.openingDays ?? [1, 2, 3, 4, 5])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [closures, setClosures] = useState<ServiceClosure[]>(service.closures ?? [])
  const [showAddClosure, setShowAddClosure] = useState(false)
  const [closureLabel, setClosureLabel] = useState('')
  const [closureStart, setClosureStart] = useState('')
  const [closureEnd, setClosureEnd] = useState('')
  const [creatingClosure, setCreatingClosure] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)

  async function handleSaveSchedule() {
    setSaving(true)
    setSaveError(null)

    const result = await apiCall<{
      data: { isOpen: boolean; reopensAt: string | null; closedReason: string | null }
    }>('PATCH', `/auth/services/${service.id}`, {
      token: auth.token,
      body: enabled
        ? { openingDays: days, openingStartTime: null, openingEndTime: null }
        : { openingDays: null, openingStartTime: null, openingEndTime: null },
    })

    setSaving(false)

    if (result.ok) {
      onServiceUpdate({
        openingDays: enabled ? days : null,
        openingStartTime: null,
        openingEndTime: null,
        ...result.data.data,
      })
      showToast('success', 'Horaires enregistrés', service.name)
    } else {
      setSaveError("Échec de l'enregistrement.")
      showToast('error', 'Échec', "Impossible d'enregistrer les jours d'ouverture.")
    }
  }

  async function handleAddClosure(e: React.FormEvent) {
    e.preventDefault()
    setCreatingClosure(true)
    setClosureError(null)

    const result = await apiCall<{ data: ServiceClosure }>('POST', `/auth/services/${service.id}/closures`, {
      token: auth.token,
      body: { label: closureLabel, startDate: closureStart, endDate: closureEnd },
    })

    setCreatingClosure(false)

    if (result.ok) {
      setClosures((prev) => [...prev, result.data.data])
      setShowAddClosure(false)
      showToast('success', 'Période de fermeture ajoutée', closureLabel)
      setClosureLabel('')
      setClosureStart('')
      setClosureEnd('')
    } else if (result.status === 422) {
      setClosureError('La date de fin doit être postérieure à la date de début.')
      showToast('error', 'Échec', 'La date de fin doit être postérieure à la date de début.')
    } else {
      setClosureError("Échec de l'ajout.")
      showToast('error', 'Échec', "Impossible d'ajouter la période de fermeture.")
    }
  }

  async function handleDeleteClosure(id: number) {
    const label = closures.find((c) => c.id === id)?.label ?? ''
    setClosures((prev) => prev.filter((c) => c.id !== id))
    const result = await apiCall('DELETE', `/auth/services/${service.id}/closures/${id}`, { token: auth.token })
    if (result.ok) showToast('success', 'Période de fermeture supprimée', label)
    else showToast('error', 'Échec', 'Impossible de supprimer la période de fermeture.')
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              Jours d'ouverture
            </p>
            <p className="text-xs text-gray-400">
              Optionnel — les jours non cochés restent fermés à la visite, mais les usagers peuvent toujours acheter
              en ligne pour un jour ouvert.
            </p>
          </div>
          {canManage && <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} />}
        </div>

        {enabled ? (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const active = days.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  disabled={!canManage}
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(d.value)
                        ? prev.filter((x) => x !== d.value)
                        : [...prev, d.value].sort((a, b) => a - b)
                    )
                  }
                  className={`squircle rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                    active ? 'bg-aregie-deep text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ouvert tous les jours.</p>
        )}

        {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}

        {canManage && (
          <PrimaryButton
            type="button"
            onClick={handleSaveSchedule}
            disabled={saving || (enabled && days.length === 0)}
            className="mt-3"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Périodes de fermeture
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowAddClosure(true)}
              style={{ fontFamily: 'var(--font-display)' }}
              className="squircle inline-flex items-center gap-1.5 rounded-full bg-aregie-deep/10 px-4 py-2 text-xs font-bold text-aregie-deep transition hover:bg-aregie-deep/15"
            >
              <Plus size={14} />
              Ajouter
            </button>
          )}
        </div>

        {closures.length === 0 ? (
          <EmptyState icon={<CalendarOff size={24} />} label="Aucune période de fermeture." />
        ) : (
          <div className="divide-y divide-gray-100">
            {closures.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{c.label}</p>
                  <p className="text-xs text-gray-400">
                    {formatDateFr(c.startDate)} – {formatDateFr(c.endDate)}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClosure(c.id)}
                    className="shrink-0 text-gray-400 transition hover:text-red-600"
                    aria-label={`Supprimer « ${c.label} »`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddClosure && (
        <Modal title="Nouvelle période de fermeture" onClose={() => setShowAddClosure(false)}>
          <form onSubmit={handleAddClosure} className="space-y-3">
            <TextInput
              placeholder="Ex. Vacances d'été"
              value={closureLabel}
              onChange={(e) => setClosureLabel(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <TextInput
                type="date"
                value={closureStart}
                onChange={(e) => setClosureStart(e.target.value)}
                required
              />
              <TextInput type="date" value={closureEnd} onChange={(e) => setClosureEnd(e.target.value)} required />
            </div>
            {closureError && <p className="text-sm text-red-600">{closureError}</p>}
            <PrimaryButton type="submit" disabled={creatingClosure} className="w-full">
              {creatingClosure ? 'Ajout…' : 'Ajouter'}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  )
}
