import { useEffect, useState } from 'react'
import { CalendarDays, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card, DangerButton, EmptyState, LoadError, Modal, PrimaryButton, SecondaryButton, StatusBadge, TextInput } from '@/components/ui'
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

const STATUS_TINTS: Record<EventAgent['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  published: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-50 text-red-600',
}

type Tab = 'upcoming' | 'draft' | 'past'

function isPastEvent(event: EventAgent): boolean {
  if (!event.eventDate) return false
  return event.eventDate < new Date().toISOString().slice(0, 10)
}

function isLiveTab(event: EventAgent, tab: Tab): boolean {
  if (tab === 'draft') return event.status === 'draft'
  if (tab === 'past') return event.status === 'closed' || (event.status === 'published' && isPastEvent(event))
  return event.status === 'published' && !isPastEvent(event)
}

// "2026-09-27" -> "dim. 27 septembre" — pas d'année (contexte "cette
// saison"), weekday abrégé pour laisser la place au reste de la ligne.
function compactDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
}

function eventMetaLabel(event: EventAgent): string {
  const parts = [event.eventDate ? compactDateLabel(event.eventDate) : null, event.timeLabel, event.location].filter(
    (p): p is string => Boolean(p),
  )
  return parts.length > 0 ? parts.join(' · ') : 'Date à définir'
}

function isEventFull(event: EventAgent): boolean {
  return event.capacity !== null && event.registeredCount >= event.capacity
}

function fillRatio(event: EventAgent): number {
  if (event.capacity === null || event.capacity === 0) return 1
  return Math.min(1, event.registeredCount / event.capacity)
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

  const [tab, setTab] = useState<Tab>('upcoming')
  const [q, setQ] = useState('')
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

  async function handlePublish(event: EventAgent) {
    setOpenMenuId(null)
    const result = await apiCall('PATCH', `/inscription/events/${event.id}`, {
      token: auth.token,
      body: { status: 'published' },
    })
    if (result.ok) showToast('success', 'Évènement publié', event.title)
    else showToast('error', 'Échec', "Impossible de publier l'évènement.")
    await loadEvents()
  }

  async function handleArchive(event: EventAgent) {
    setOpenMenuId(null)
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

  const liveEvents = events?.filter((e) => e.status !== 'archived' && e.status !== 'cancelled') ?? []
  const archivedEvents = events?.filter((e) => e.status === 'archived' || e.status === 'cancelled') ?? []

  const tabCounts: Record<Tab, number> = {
    upcoming: liveEvents.filter((e) => isLiveTab(e, 'upcoming')).length,
    draft: liveEvents.filter((e) => isLiveTab(e, 'draft')).length,
    past: liveEvents.filter((e) => isLiveTab(e, 'past')).length,
  }

  const qTrimmed = q.trim().toLowerCase()
  const visibleEvents = liveEvents.filter(
    (e) => isLiveTab(e, tab) && (!qTrimmed || e.title.toLowerCase().includes(qTrimmed)),
  )

  const TAB_LABELS: Record<Tab, string> = { upcoming: 'À venir', draft: 'Brouillons', past: 'Passés' }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <TextInput
              type="text"
              placeholder="Rechercher un évènement…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {(['upcoming', 'draft', 'past'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`squircle rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t ? 'bg-aregie-deep text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {TAB_LABELS[t]} · {tabCounts[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {loadFailed && <LoadError onRetry={loadEvents} />}
          {!loadFailed && showLoading && <p className="py-3 text-sm text-gray-500">Chargement…</p>}
          {!loadFailed && !showLoading && visibleEvents.length === 0 && (
            <div className="py-2">
              <EmptyState
                icon={<CalendarDays size={24} />}
                label={qTrimmed ? 'Aucun évènement ne correspond à la recherche.' : `Aucun évènement « ${TAB_LABELS[tab].toLowerCase()} ».`}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {visibleEvents.map((event) => {
              const past = tab === 'past'
              const dimmed = event.status === 'draft' || past
              const full = isEventFull(event)

              return (
                <Card key={event.id} className="relative flex flex-wrap items-center gap-3 p-0 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${dimmed ? 'text-gray-500' : 'text-gray-900'}`}>{event.title}</p>
                    <p className="truncate text-xs text-gray-400">{eventMetaLabel(event)}</p>
                  </div>

                  <StatusBadge label={STATUS_LABELS[event.status]} className={STATUS_TINTS[event.status]} />

                  <div className="w-32 shrink-0">
                    {event.status === 'draft' ? (
                      <p className="text-right text-xs font-medium text-gray-400">Non publié</p>
                    ) : event.status === 'published' && !past ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-700">
                            {event.capacity === null ? `Illimité · ${event.registeredCount}` : `${event.registeredCount} / ${event.capacity}`}
                          </span>
                          {full && (
                            <span className="squircle rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              Complet
                            </span>
                          )}
                        </div>
                        <div className="h-[5px] w-full rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${full ? 'bg-amber-500' : event.capacity === null ? 'bg-gray-300' : 'bg-aregie-deep'}`}
                            style={{ width: `${fillRatio(event) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-right text-xs font-semibold text-gray-400">
                        {event.capacity === null ? `${event.registeredCount} inscrits` : `${event.registeredCount} / ${event.capacity}`}
                      </p>
                    )}
                  </div>

                  <p className={`w-20 shrink-0 text-right text-sm font-bold ${
                    !dimmed && event.priceCents === 0 ? 'text-emerald-600' : dimmed ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
                  </p>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {event.status === 'draft' ? (
                        <PrimaryButton type="button" onClick={() => handlePublish(event)} className="px-3 py-1.5 text-xs">
                          Publier
                        </PrimaryButton>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setViewingRegistrationsFor(event)}
                          className={`squircle inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            event.pendingReviewCount > 0
                              ? 'bg-aregie-coral/10 text-aregie-coral hover:bg-aregie-coral/15'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Inscrits
                          {event.pendingReviewCount > 0 && (
                            <span className="squircle flex h-4 min-w-4 items-center justify-center rounded-full bg-aregie-coral px-1 text-[10px] font-bold text-white">
                              {event.pendingReviewCount}
                            </span>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === event.id ? null : event.id)}
                        className="squircle flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                        aria-label={`Actions pour « ${event.title} »`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  )}

                  {openMenuId === event.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                      <div className="squircle absolute top-full right-4 z-50 mt-1 w-52 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.28)]">
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Modifier l'évènement
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(event)}
                          className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Archiver
                        </button>
                        <div className="my-1 h-px bg-gray-100" />
                        {past ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              setDeletingEvent(event)
                            }}
                            className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Supprimer définitivement
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              setCancellingEvent(event)
                            }}
                            className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Annuler l'évènement
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </Card>

      {canManage && archivedEvents.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Archivés &amp; annulés</p>
          <div className="flex flex-col gap-2">
            {archivedEvents.map((event) => (
              <Card key={event.id} className="flex items-center gap-3 p-0 px-4 py-3 opacity-60">
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
              </Card>
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
