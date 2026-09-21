import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { apiCall } from '@/lib/api'
import type { AuthState } from '@/lib/types'

// Réduit par rapport à l'ancien 60s — le flux d'activité (annulations,
// réponses liste d'attente) gagne à être quasi instantané pour l'agent,
// sans pour autant justifier un WebSocket (aucune infra de ce genre dans
// ce projet, voir svc-mail/svc-inscription : tout est en polling REST).
const POLL_INTERVAL_MS = 20_000

interface PendingEvent {
  eventId: number
  eventTitle: string
  serviceId: number
  count: number
}

type NotificationType =
  | 'registration_cancelled'
  | 'waitlist_offer_accepted'
  | 'waitlist_offer_declined'
  | 'waitlist_offer_expired'

interface AgentNotification {
  id: number
  type: NotificationType
  citizenName: string
  eventTitle: string
  eventId: number
  serviceId: number
  createdAt: string
}

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  registration_cancelled: 'a annulé son inscription',
  waitlist_offer_accepted: 'a confirmé sa place (liste d’attente)',
  waitlist_offer_declined: 'a quitté la liste d’attente',
  waitlist_offer_expired: "n'a pas répondu à temps (liste d’attente)",
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

// Badge + menu "inscriptions à vérifier", en haut à droite de chaque page
// organisme (voir OrgSpace.tsx) — seul signal visible d'une action requise
// en dehors du panneau par évènement (EventsManager/EventRegistrationsPanel).
// Le clic ouvre le détail par évènement plutôt que de renvoyer à l'aveugle
// vers /services — chaque ligne emmène directement au bon évènement.
// N'apparaît que pour les organismes qui utilisent le module inscription.
export function NotificationBell({ auth }: { auth: AuthState }) {
  const navigate = useNavigate()
  const hasInscriptionService = auth.services.some((s) => s.serviceType === 'inscription')
  const [count, setCount] = useState(0)
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [notifications, setNotifications] = useState<AgentNotification[]>([])
  const [open, setOpen] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)

  useEffect(() => {
    if (!hasInscriptionService) return

    let cancelled = false
    async function load() {
      const [reviewResult, notifResult] = await Promise.all([
        apiCall<{ data: { count: number; events: PendingEvent[] } }>(
          'GET',
          '/inscription/pending-review-count',
          { token: auth.token },
        ),
        apiCall<{ data: { count: number; notifications: AgentNotification[] } }>(
          'GET',
          '/inscription/notifications',
          { token: auth.token },
        ),
      ])
      if (cancelled) return
      if (reviewResult.ok) {
        setCount(reviewResult.data.data.count)
        setEvents(reviewResult.data.data.events)
      }
      if (notifResult.ok) setNotifications(notifResult.data.data.notifications)
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [auth.token, hasInscriptionService])

  async function markAllNotificationsRead() {
    if (notifications.length === 0) return
    setMarkingRead(true)
    const result = await apiCall('POST', '/inscription/notifications/mark-read', {
      token: auth.token,
      body: { ids: notifications.map((n) => n.id) },
    })
    setMarkingRead(false)
    if (result.ok) setNotifications([])
  }

  if (!hasInscriptionService) return null

  const totalBadge = count + notifications.length

  function goToEvent(pending: PendingEvent) {
    setOpen(false)
    navigate(`/services/${pending.serviceId}?openEvent=${pending.eventId}`)
  }

  function goToNotification(n: AgentNotification) {
    setOpen(false)
    navigate(`/services/${n.serviceId}?openEvent=${n.eventId}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="squircle relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
        aria-label={totalBadge > 0 ? `${totalBadge} notification(s)` : 'Aucune notification'}
      >
        <Bell size={18} />
        {totalBadge > 0 && (
          <span className="squircle absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aregie-coral px-1 text-[10px] font-bold text-white">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="squircle absolute top-full right-0 z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.28)]">
            <p className="px-3 py-2 text-[11.5px] font-semibold tracking-wide text-gray-400 uppercase">
              Inscriptions à vérifier
            </p>
            {events.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">Rien à vérifier pour l'instant.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {events.map((e) => (
                  <button
                    key={e.eventId}
                    type="button"
                    onClick={() => goToEvent(e)}
                    className="squircle flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-gray-800">{e.eventTitle}</span>
                    <span className="squircle flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-aregie-coral px-1.5 text-[11px] font-bold text-white">
                      {e.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-1 flex items-center justify-between px-3 py-2">
              <p className="text-[11.5px] font-semibold tracking-wide text-gray-400 uppercase">Activité récente</p>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  disabled={markingRead}
                  className="text-[11.5px] font-semibold text-aregie-deep hover:underline disabled:opacity-50"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">Aucune activité récente.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => goToNotification(n)}
                    className="squircle flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-800">
                      <span className="font-semibold">{n.citizenName}</span> {NOTIFICATION_LABELS[n.type]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {n.eventTitle} · {relativeTime(n.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
