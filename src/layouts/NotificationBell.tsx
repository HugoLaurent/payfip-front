import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { apiCall } from '@/lib/api'
import type { AuthState } from '@/lib/types'

const POLL_INTERVAL_MS = 60_000

interface PendingEvent {
  eventId: number
  eventTitle: string
  serviceId: number
  count: number
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasInscriptionService) return

    let cancelled = false
    async function load() {
      const result = await apiCall<{ data: { count: number; events: PendingEvent[] } }>(
        'GET',
        '/inscription/pending-review-count',
        { token: auth.token },
      )
      if (!cancelled && result.ok) {
        setCount(result.data.data.count)
        setEvents(result.data.data.events)
      }
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [auth.token, hasInscriptionService])

  if (!hasInscriptionService) return null

  function goToEvent(pending: PendingEvent) {
    setOpen(false)
    navigate(`/services/${pending.serviceId}?openEvent=${pending.eventId}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="squircle relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
        aria-label={count > 0 ? `${count} inscription(s) à vérifier` : 'Aucune inscription à vérifier'}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="squircle absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aregie-coral px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="squircle absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.28)]">
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
          </div>
        </>
      )}
    </div>
  )
}
