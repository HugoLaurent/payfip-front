import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { apiCall } from '@/lib/api'
import type { AuthState } from '@/lib/types'

const POLL_INTERVAL_MS = 60_000

// Badge global "inscriptions à vérifier", en haut à droite de chaque page
// organisme (voir OrgSpace.tsx) — seul signal visible d'une action requise
// en dehors du panneau par évènement (EventsManager/EventRegistrationsPanel).
// N'apparaît que pour les organismes qui utilisent le module inscription.
export function NotificationBell({ auth }: { auth: AuthState }) {
  const navigate = useNavigate()
  const hasInscriptionService = auth.services.some((s) => s.serviceType === 'inscription')
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!hasInscriptionService) return

    let cancelled = false
    async function load() {
      const result = await apiCall<{ data: { count: number } }>('GET', '/inscription/pending-review-count', {
        token: auth.token,
      })
      if (!cancelled && result.ok) setCount(result.data.data.count)
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [auth.token, hasInscriptionService])

  if (!hasInscriptionService) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/services')}
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
  )
}
