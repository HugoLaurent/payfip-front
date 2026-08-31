import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2, Users } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card, DangerButton, EmptyState, LoadError, Modal, SecondaryButton } from '@/components/ui'
import { EventFormPanel, EMPTY_EVENT_FORM, eventToForm, eventFormToPayload, type EventFormState } from './EventFormPanel'
import { EventRegistrationsPanel } from './EventRegistrationsPanel'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import type { AuthState, EventAgent, ServiceRow } from '@/lib/types'

const STATUS_LABELS: Record<EventAgent['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  closed: 'Clos',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

function isPastEvent(event: EventAgent): boolean {
  if (!event.eventDate) return false
  return event.eventDate < new Date().toISOString().slice(0, 10)
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
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deletingEvent, setDeletingEvent] = useState<EventAgent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [cancellingEvent, setCancellingEvent] = useState<EventAgent | null>(null)
  const [cancelling, setCancelling] = useState(false)

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
    setForm(EMPTY_EVENT_FORM)
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

    const payload = eventFormToPayload(form)
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

  // Annulation : bascule l'évènement et ses inscriptions actives en
  // `cancelled` côté back, qui envoie l'email d'annulation à chaque
  // inscrit — ne supprime aucune ligne, contrairement à handleDelete.
  async function handleCancelEvent() {
    if (!cancellingEvent) return
    setCancelling(true)
    const result = await apiCall('POST', `/inscription/events/${cancellingEvent.id}/cancel`, { token: auth.token })
    setCancelling(false)
    setCancellingEvent(null)
    if (result.ok) {
      showToast('success', 'Évènement annulé', `Les inscrits ont été prévenus par email.`)
      await loadEvents()
    } else {
      showToast('error', 'Échec', "Impossible d'annuler l'évènement.")
    }
  }

  const activeEvents = events?.filter((e) => e.status !== 'archived' && e.status !== 'cancelled') ?? []
  const archivedEvents = events?.filter((e) => e.status === 'archived' || e.status === 'cancelled') ?? []

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
                  className={`squircle inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    event.pendingReviewCount > 0
                      ? 'bg-aregie-coral/10 text-aregie-coral hover:bg-aregie-coral/15'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Users size={13} />
                  Inscrits
                  {event.pendingReviewCount > 0 && (
                    <span className="squircle flex h-4 min-w-4 items-center justify-center rounded-full bg-aregie-coral px-1 text-[10px] font-bold text-white">
                      {event.pendingReviewCount}
                    </span>
                  )}
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
              {canManage && !isPastEvent(event) && (
                <button
                  type="button"
                  onClick={() => setCancellingEvent(event)}
                  className="shrink-0 text-xs font-semibold text-aregie-coral transition hover:text-aregie-coral/80"
                >
                  Annuler l'évènement
                </button>
              )}
              {canManage && isPastEvent(event) && (
                <button
                  type="button"
                  onClick={() => setDeletingEvent(event)}
                  className="shrink-0 text-gray-400 transition hover:text-red-600"
                  aria-label={`Supprimer « ${event.title} »`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {canManage && archivedEvents.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Archivés &amp; annulés</p>
          <Card>
            <div className="divide-y divide-gray-100">
              {archivedEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 py-3 opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
                    <p className="truncate text-xs text-gray-400">{STATUS_LABELS[event.status]}</p>
                  </div>
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
        <EventFormPanel
          editingEvent={editingEvent}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={handleSubmit}
          onClose={() => setShowFormModal(false)}
          saving={saving}
          error={formError}
        />
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

      {cancellingEvent && (
        <Modal title="Annuler cet évènement ?" onClose={() => setCancellingEvent(null)}>
          <p className="mb-4 text-sm text-gray-600">
            Tous les inscrits à « {cancellingEvent.title} » recevront un email les informant de l'annulation. Ceux
            qui avaient déjà payé seront invités à vous contacter directement pour convenir d'un remboursement —
            aucun remboursement automatique n'est déclenché. Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <DangerButton type="button" onClick={handleCancelEvent} disabled={cancelling} className="px-4 py-2">
              {cancelling ? 'Annulation…' : "Annuler l'évènement"}
            </DangerButton>
            <SecondaryButton type="button" onClick={() => setCancellingEvent(null)}>
              Retour
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
