import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2, Users } from 'lucide-react'
import { apiCall } from '@/lib/api'
import {
  Card,
  DangerButton,
  EmptyState,
  LoadError,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  Switch,
  TextInput,
  Textarea,
} from '@/components/ui'
import { FormSchemaBuilder } from './FormSchemaBuilder'
import { EventRegistrationsPanel } from './EventRegistrationsPanel'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import type { AuthState, EventAgent, RegistrationFormField, ServiceRow } from '@/lib/types'

const STATUS_LABELS: Record<EventAgent['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  closed: 'Clos',
  archived: 'Archivé',
}

interface EventFormState {
  type: 'formation' | 'evenement'
  title: string
  description: string
  eventDate: string
  startTime: string
  endTime: string
  timeLabel: string
  location: string
  category: string
  registrationDeadline: string
  priceCents: string
  requiresDocuments: boolean
  documentInstructions: string
  capacity: string
  maxParticipantsPerRegistration: string
  formSchema: RegistrationFormField[]
  status: EventAgent['status']
}

const EMPTY_FORM: EventFormState = {
  type: 'formation',
  title: '',
  description: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  timeLabel: '',
  location: '',
  category: '',
  registrationDeadline: '',
  priceCents: '0',
  requiresDocuments: false,
  documentInstructions: '',
  capacity: '',
  maxParticipantsPerRegistration: '1',
  formSchema: [],
  status: 'draft',
}

function eventToForm(event: EventAgent): EventFormState {
  return {
    type: event.type,
    title: event.title,
    description: event.description ?? '',
    eventDate: event.eventDate ?? '',
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    timeLabel: event.timeLabel ?? '',
    location: event.location ?? '',
    category: event.category ?? '',
    registrationDeadline: event.registrationDeadline ? event.registrationDeadline.slice(0, 16) : '',
    priceCents: (event.priceCents / 100).toString(),
    requiresDocuments: event.requiresDocuments,
    documentInstructions: event.documentInstructions ?? '',
    capacity: event.capacity !== null ? String(event.capacity) : '',
    maxParticipantsPerRegistration: String(event.maxParticipantsPerRegistration),
    formSchema: event.formSchema ?? [],
    status: event.status,
  }
}

function formToPayload(form: EventFormState) {
  return {
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    eventDate: form.eventDate || undefined,
    startTime: form.startTime || undefined,
    endTime: form.endTime || undefined,
    timeLabel: form.timeLabel.trim() || undefined,
    location: form.location.trim() || undefined,
    category: form.category.trim() || undefined,
    registrationDeadline: form.registrationDeadline || undefined,
    priceCents: Math.round(Number(form.priceCents || '0') * 100),
    requiresDocuments: form.requiresDocuments,
    documentInstructions: form.documentInstructions.trim() || undefined,
    capacity: form.capacity ? Number(form.capacity) : undefined,
    maxParticipantsPerRegistration: Number(form.maxParticipantsPerRegistration || '1'),
    formSchema: form.formSchema.length > 0 ? form.formSchema : undefined,
    status: form.status,
  }
}

// Gestion des évènements/formations d'un service `inscription` — création,
// édition, archivage, et accès au résumé des inscrits par évènement (voir
// EventRegistrationsPanel). Même châssis que TariffsManager.
export function EventsManager({ auth, service }: { auth: AuthState; service: ServiceRow }) {
  const servicePermissions = auth.services.find((s) => s.id === service.id)?.permissions
  const canManage = auth.role === 'admin' || servicePermissions?.canManageTariffs === true
  const { showToast } = useToast()

  const [events, setEvents] = useState<EventAgent[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const showLoading = useDelayedLoading(events === null)

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventAgent | null>(null)
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deletingEvent, setDeletingEvent] = useState<EventAgent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [viewingRegistrationsFor, setViewingRegistrationsFor] = useState<EventAgent | null>(null)

  async function loadEvents() {
    setLoadFailed(false)
    const result = await apiCall<{ data: EventAgent[] }>(
      'GET',
      `/inscription/services/${service.id}/events`,
      { token: auth.token },
    )
    if (result.ok) setEvents(result.data.data)
    else setLoadFailed(true)
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id])

  function openCreate() {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowFormModal(true)
  }

  function openEdit(event: EventAgent) {
    setEditingEvent(event)
    setForm(eventToForm(event))
    setFormError(null)
    setShowFormModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    setSaving(true)
    setFormError(null)

    const payload = formToPayload(form)
    const result = editingEvent
      ? await apiCall('PATCH', `/inscription/events/${editingEvent.id}`, { token: auth.token, body: payload })
      : await apiCall('POST', `/inscription/services/${service.id}/events`, { token: auth.token, body: payload })

    setSaving(false)

    if (result.ok) {
      showToast('success', editingEvent ? 'Évènement modifié' : 'Évènement créé', form.title)
      setShowFormModal(false)
      await loadEvents()
    } else if (result.status === 409) {
      setFormError('Cet identifiant (slug) est déjà utilisé pour ce service.')
    } else {
      setFormError('Échec de l\'enregistrement.')
      showToast('error', 'Échec', "Impossible d'enregistrer l'évènement.")
    }
  }

  async function handleArchive(event: EventAgent) {
    const result = await apiCall('PATCH', `/inscription/events/${event.id}`, {
      token: auth.token,
      body: { status: 'archived' },
    })
    if (result.ok) showToast('success', 'Évènement archivé', event.title)
    else showToast('error', 'Échec', "Impossible d'archiver l'évènement.")
    await loadEvents()
  }

  async function handleDelete() {
    if (!deletingEvent) return
    setDeleting(true)
    const result = await apiCall('DELETE', `/inscription/events/${deletingEvent.id}`, { token: auth.token })
    setDeleting(false)
    setDeletingEvent(null)
    if (result.ok) {
      showToast('success', 'Évènement supprimé', deletingEvent.title)
      await loadEvents()
    } else if (result.status === 409) {
      showToast('error', 'Échec', 'Cet évènement a des inscriptions et ne peut pas être supprimé.')
    } else {
      showToast('error', 'Échec', "Impossible de supprimer l'évènement.")
    }
  }

  const activeEvents = events?.filter((e) => e.status !== 'archived') ?? []
  const archivedEvents = events?.filter((e) => e.status === 'archived') ?? []

  return (
    <div>
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Formations &amp; évènements
          </h3>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              style={{ fontFamily: 'var(--font-display)' }}
              className="squircle inline-flex items-center gap-1.5 rounded-full bg-aregie-deep/10 px-4 py-2 text-xs font-bold text-aregie-deep transition hover:bg-aregie-deep/15"
            >
              <Plus size={14} />
              Nouvel évènement
            </button>
          )}
        </div>

        {loadFailed && <LoadError onRetry={loadEvents} />}
        {!loadFailed && showLoading && <p className="py-3 text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && activeEvents.length === 0 && (
          <div className="py-2">
            <EmptyState icon={<CalendarDays size={24} />} label="Aucun évènement." />
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {activeEvents.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
                <p className="truncate text-xs text-gray-400">
                  {STATUS_LABELS[event.status]}
                  {event.eventDate ? ` · ${event.eventDate}` : ''}
                  {event.capacity !== null ? ` · ${event.capacity} places` : ''}
                </p>
              </div>
              <p className={`w-20 shrink-0 text-right text-sm font-bold ${event.priceCents === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setViewingRegistrationsFor(event)}
                  className="squircle inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
                >
                  <Users size={13} />
                  Inscrits
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => openEdit(event)}
                  className="shrink-0 text-xs font-semibold text-aregie-blue"
                >
                  Modifier
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleArchive(event)}
                  className="shrink-0 text-xs font-semibold text-gray-400 transition hover:text-red-600"
                >
                  Archiver
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {canManage && archivedEvents.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Évènements archivés</p>
          <Card>
            <div className="divide-y divide-gray-100">
              {archivedEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 py-3 opacity-60">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{event.title}</p>
                  <button
                    type="button"
                    onClick={() => setDeletingEvent(event)}
                    className="shrink-0 text-gray-400 transition hover:text-red-600"
                    aria-label={`Supprimer « ${event.title} »`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {showFormModal && (
        <Modal title={editingEvent ? `Modifier « ${editingEvent.title} »` : 'Nouvel évènement'} onClose={() => setShowFormModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <SelectInput
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'formation' | 'evenement' }))}
                className="w-40"
              >
                <option value="formation">Formation</option>
                <option value="evenement">Évènement</option>
              </SelectInput>
              <TextInput
                type="text"
                placeholder="Titre"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="flex-1"
              />
            </div>

            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              rows={2}
            />

            <div className="flex gap-2">
              <TextInput
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="flex-1"
              />
              <TextInput
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-28"
              />
              <TextInput
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-28"
              />
            </div>
            <TextInput
              type="text"
              placeholder="Libellé horaire affiché (ex: 9h–17h) — facultatif"
              value={form.timeLabel}
              onChange={(e) => setForm((f) => ({ ...f, timeLabel: e.target.value }))}
            />
            <div className="flex gap-2">
              <TextInput
                type="text"
                placeholder="Lieu"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="flex-1"
              />
              <TextInput
                type="text"
                placeholder="Catégorie (ex: Sport)"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="flex-1"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Clôture des inscriptions</label>
              <TextInput
                type="datetime-local"
                value={form.registrationDeadline}
                onChange={(e) => setForm((f) => ({ ...f, registrationDeadline: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Tarif (€)</label>
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.priceCents}
                  onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Places (vide = illimité)</label>
                <TextInput
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Participants max/inscription</label>
                <TextInput
                  type="number"
                  min="1"
                  value={form.maxParticipantsPerRegistration}
                  onChange={(e) => setForm((f) => ({ ...f, maxParticipantsPerRegistration: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between squircle rounded-xl border border-gray-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-700">Justificatif requis</p>
                <p className="text-xs text-gray-400">L'agent devra valider le document avant confirmation.</p>
              </div>
              <Switch
                checked={form.requiresDocuments}
                onChange={() => setForm((f) => ({ ...f, requiresDocuments: !f.requiresDocuments }))}
              />
            </div>
            {form.requiresDocuments && (
              <Textarea
                value={form.documentInstructions}
                onChange={(e) => setForm((f) => ({ ...f, documentInstructions: e.target.value }))}
                placeholder="Instructions affichées au citoyen (ex: justificatif de domicile de moins de 3 mois)"
                rows={2}
              />
            )}

            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">Formulaire d'inscription</label>
              <FormSchemaBuilder
                fields={form.formSchema}
                onChange={(formSchema) => setForm((f) => ({ ...f, formSchema }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Statut</label>
              <SelectInput
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventAgent['status'] }))}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <PrimaryButton type="submit" disabled={saving} className="w-full">
              {saving ? 'Enregistrement…' : editingEvent ? 'Enregistrer' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {deletingEvent && (
        <Modal title="Supprimer définitivement ?" onClose={() => setDeletingEvent(null)}>
          <p className="mb-4 text-sm text-gray-600">
            L'évènement « {deletingEvent.title} » sera supprimé définitivement — impossible s'il a des inscriptions.
          </p>
          <div className="flex gap-2">
            <DangerButton type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2">
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </DangerButton>
            <SecondaryButton type="button" onClick={() => setDeletingEvent(null)}>
              Annuler
            </SecondaryButton>
          </div>
        </Modal>
      )}

      {viewingRegistrationsFor && (
        <EventRegistrationsPanel
          auth={auth}
          event={viewingRegistrationsFor}
          onClose={() => setViewingRegistrationsFor(null)}
        />
      )}
    </div>
  )
}
