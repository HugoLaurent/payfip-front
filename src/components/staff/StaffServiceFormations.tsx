import { useEffect, useState } from 'react'
import { CalendarDays, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { DangerButton, EmptyState, LoadError, Modal, PrimaryButton, SecondaryButton, StatusBadge } from '@/components/ui'
import {
  EventFormPanel,
  EMPTY_EVENT_FORM,
  eventToForm,
  eventFormToPayload,
  type EventFormState,
} from '@/components/org/EventFormPanel'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import type { EventAgent, ServiceRow } from '@/lib/types'

const STATUS_LABELS: Record<EventAgent['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  closed: 'Clos',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const STATUS_TINTS: Record<EventAgent['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  published: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-50 text-red-600',
}

// Equivalent staff de components/org/EventsManager.tsx — reutilise
// EventFormPanel tel quel (purement presentationnel, aucun appel API a
// l'interieur). Pas de panneau "Inscrits" ici : les inscriptions se
// gerent depuis StaffRegistrationsPage, pas d'ici.
export function StaffServiceFormations({ staffToken, service }: { staffToken: string; service: ServiceRow }) {
  const { showToast } = useToast()

  const [events, setEvents] = useState<EventAgent[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const showLoading = useDelayedLoading(events === null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventAgent | null>(null)
  const [form, setForm] = useState<EventFormState>(EMPTY_EVENT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deletingEvent, setDeletingEvent] = useState<EventAgent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [cancellingEvent, setCancellingEvent] = useState<EventAgent | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function loadEvents() {
    setLoadFailed(false)
    const result = await apiCall<{ data: EventAgent[] }>('GET', `/staff/events?serviceId=${service.id}`, {
      staffToken,
    })
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
    setOpenMenuId(null)
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
      ? await apiCall('PATCH', `/staff/events/${editingEvent.id}?serviceId=${service.id}`, { staffToken, body: payload })
      : await apiCall('POST', `/staff/services/${service.id}/events`, { staffToken, body: payload })

    setSaving(false)

    if (result.ok) {
      showToast('success', editingEvent ? 'Évènement modifié' : 'Évènement créé', form.title)
      setShowFormModal(false)
      await loadEvents()
    } else if (result.status === 409) {
      setFormError('Cet identifiant (slug) est déjà utilisé pour ce service.')
    } else {
      setFormError("Échec de l'enregistrement.")
    }
  }

  async function handlePublish(event: EventAgent) {
    setOpenMenuId(null)
    const result = await apiCall('PATCH', `/staff/events/${event.id}?serviceId=${service.id}`, {
      staffToken,
      body: { status: 'published' },
    })
    if (result.ok) showToast('success', 'Évènement publié', event.title)
    else showToast('error', 'Échec', "Impossible de publier l'évènement.")
    await loadEvents()
  }

  async function handleArchive(event: EventAgent) {
    setOpenMenuId(null)
    const result = await apiCall('PATCH', `/staff/events/${event.id}?serviceId=${service.id}`, {
      staffToken,
      body: { status: 'archived' },
    })
    if (result.ok) showToast('success', 'Évènement archivé', event.title)
    else showToast('error', 'Échec', "Impossible d'archiver l'évènement.")
    await loadEvents()
  }

  async function handleDelete() {
    if (!deletingEvent) return
    setDeleting(true)
    const result = await apiCall('DELETE', `/staff/events/${deletingEvent.id}?serviceId=${service.id}`, { staffToken })
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

  async function handleCancelEvent() {
    if (!cancellingEvent) return
    setCancelling(true)
    const result = await apiCall('POST', `/staff/events/${cancellingEvent.id}/cancel?serviceId=${service.id}`, {
      staffToken,
    })
    setCancelling(false)
    setCancellingEvent(null)
    if (result.ok) {
      showToast('success', 'Évènement annulé', 'Les inscrits ont été prévenus par email.')
      await loadEvents()
    } else {
      showToast('error', 'Échec', "Impossible d'annuler l'évènement.")
    }
  }

  const liveEvents = events?.filter((e) => e.status !== 'archived' && e.status !== 'cancelled') ?? []
  const archivedEvents = events?.filter((e) => e.status === 'archived' || e.status === 'cancelled') ?? []

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Formations &amp; évènements</p>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1 text-xs font-semibold text-aregie-blue"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>

      {loadFailed && <LoadError onRetry={loadEvents} />}
      {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && !showLoading && liveEvents.length === 0 && (
        <EmptyState icon={<CalendarDays size={20} />} label="Aucun évènement." />
      )}

      <div className="space-y-1.5">
        {liveEvents.map((event) => (
          <div key={event.id} className="relative flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
              <p className="text-xs text-gray-400">
                {event.registeredCount} inscrit{event.registeredCount > 1 ? 's' : ''} ·{' '}
                {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
              </p>
            </div>
            <StatusBadge label={STATUS_LABELS[event.status]} className={STATUS_TINTS[event.status]} />
            {event.status === 'draft' && (
              <PrimaryButton type="button" onClick={() => handlePublish(event)} className="px-2.5 py-1 text-xs">
                Publier
              </PrimaryButton>
            )}
            <button
              type="button"
              onClick={() => setOpenMenuId(openMenuId === event.id ? null : event.id)}
              className="squircle flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <MoreHorizontal size={14} />
            </button>

            {openMenuId === event.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                <div className="squircle absolute top-full right-0 z-50 mt-1 w-48 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.28)]">
                  <button
                    type="button"
                    onClick={() => openEdit(event)}
                    className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(event)}
                    className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Archiver
                  </button>
                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null)
                      setCancellingEvent(event)
                    }}
                    className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Annuler l'évènement
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {archivedEvents.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">Archivés &amp; annulés</p>
          <div className="space-y-1.5">
            {archivedEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 opacity-60">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{event.title}</p>
                <button type="button" onClick={() => setDeletingEvent(event)} className="shrink-0 text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
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
            Tous les inscrits à « {cancellingEvent.title} » recevront un email les informant de l'annulation. Cette
            action est irréversible.
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
    </div>
  )
}
