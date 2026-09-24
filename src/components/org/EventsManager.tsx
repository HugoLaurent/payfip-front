import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus, Search, Trash2 } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card, DangerButton, EmptyState, LoadError, Modal, SecondaryButton, TextInput } from '@/components/ui'
import { EventFormPanel, EMPTY_EVENT_FORM, eventToForm, eventFormToPayload, type EventFormState } from './EventFormPanel'
import { EventRegistrationsPanel } from './EventRegistrationsPanel'
import { EventCard } from './EventCard'
import { isLiveTab, type Tab } from './eventHelpers'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { useToast } from '@/lib/useToast'
import { EVENT_STATUS_LABELS as STATUS_LABELS } from '@/lib/serviceLabels'
import type { AuthState, EventAgent, ServiceRow } from '@/lib/types'

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

  // Sert à la fois de sélection maître-détail (colonne de droite, desktop)
  // et d'écran "Inscrits" dédié (plein écran, mobile) — un seul état, deux
  // habillages (voir EventRegistrationsPanel, prop `variant`).
  const [selectedEvent, setSelectedEvent] = useState<EventAgent | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useIsDesktop()

  async function loadEvents() {
    setLoadFailed(false)
    const result = await apiCall<{ data: EventAgent[] }>(
      'GET',
      `/inscription/services/${service.id}/events`,
      { token: auth.token },
    )
    if (result.ok) {
      setEvents(result.data.data)
      // selectedEvent référence l'objet d'avant ce refetch — sans ce
      // resync, le panneau de détail affiche un statut/compteurs périmés
      // après publish/archive/révision de justificatif tant que l'agent
      // ne resélectionne pas l'évènement. Repasse à null si l'évènement a
      // disparu de la liste (ex. suppression).
      setSelectedEvent((prev) => (prev ? (result.data.data.find((e) => e.id === prev.id) ?? null) : prev))
    } else {
      setLoadFailed(true)
    }
  }

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id])

  // Ouverture directe depuis le menu de la cloche de notification
  // (NotificationBell.tsx, ?openEvent=<id>) — une fois la liste chargée,
  // ouvre le panneau d'inscrits de l'évènement visé puis nettoie l'URL.
  useEffect(() => {
    const openEventId = searchParams.get('openEvent')
    if (!openEventId || !events) return
    const target = events.find((e) => e.id === Number(openEventId))
    if (target) setSelectedEvent(target)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('openEvent')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchParams])

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
      ? await apiCall('PATCH', `/inscription/events/${editingEvent.id}?serviceId=${service.id}`, { token: auth.token, body: payload })
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
    const result = await apiCall('PATCH', `/inscription/events/${event.id}?serviceId=${service.id}`, {
      token: auth.token,
      body: { status: 'published' },
    })
    if (result.ok) showToast('success', 'Évènement publié', event.title)
    else showToast('error', 'Échec', "Impossible de publier l'évènement.")
    await loadEvents()
  }

  async function handleArchive(event: EventAgent) {
    setOpenMenuId(null)
    const result = await apiCall('PATCH', `/inscription/events/${event.id}?serviceId=${service.id}`, {
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
    const result = await apiCall('DELETE', `/inscription/events/${deletingEvent.id}?serviceId=${service.id}`, { token: auth.token })
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
    const result = await apiCall('POST', `/inscription/events/${cancellingEvent.id}/cancel?serviceId=${service.id}`, { token: auth.token })
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

      <div className={isDesktop ? 'grid grid-cols-[340px_minmax(0,640px)] items-start gap-4' : undefined}>
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

          <div className={isDesktop ? 'p-2' : 'p-4'}>
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
              {visibleEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isPastTab={tab === 'past'}
                  isDesktop={isDesktop}
                  selected={isDesktop && selectedEvent?.id === event.id}
                  canManage={canManage}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onSelect={setSelectedEvent}
                  onEdit={openEdit}
                  onArchive={handleArchive}
                  onPublish={handlePublish}
                  onRequestDelete={setDeletingEvent}
                  onRequestCancel={setCancellingEvent}
                />
              ))}
            </div>
          </div>
        </Card>

        {isDesktop && (
          <div className="squircle flex min-h-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(20,25,60,0.06)]">
            {selectedEvent ? (
              <EventRegistrationsPanel
                auth={auth}
                event={selectedEvent}
                variant="panel"
                onClose={() => setSelectedEvent(null)}
                onRegistrationsChanged={loadEvents}
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center p-6">
                <EmptyState icon={<CalendarDays size={24} />} label="Sélectionnez un évènement pour voir ses inscrits." />
              </div>
            )}
          </div>
        )}
      </div>

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

      {!isDesktop && selectedEvent && (
        <EventRegistrationsPanel
          auth={auth}
          event={selectedEvent}
          variant="sheet"
          onClose={() => setSelectedEvent(null)}
          onRegistrationsChanged={loadEvents}
        />
      )}
    </div>
  )
}
