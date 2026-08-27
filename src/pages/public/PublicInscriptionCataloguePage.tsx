import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { apiCall } from '@/lib/api'
import { LoadError } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { Formation, ServiceLookup } from '@/lib/types'
import { PublicShell } from '@/layouts/PublicShell'
import { FormationCard, PublicServiceHeader } from '@/components/public'

// Écran A1 — entrée par le catalogue : plusieurs formations, le citoyen
// compare, filtre, puis entre dans une fiche (voir maquette "Parcours
// Inscription").
export function PublicInscriptionCataloguePage() {
  const { slug } = useParams<{ slug: string }>()
  const [logoFailed, setLogoFailed] = useState(false)
  const [category, setCategory] = useState<string>('Tout')

  const [service, setService] = useState<ServiceLookup | null>(null)
  const [serviceError, setServiceError] = useState(false)
  const [events, setEvents] = useState<Formation[] | null>(null)
  const [eventsFailed, setEventsFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const showServiceLoading = useDelayedLoading(service === null && !serviceError)
  const showEventsLoading = useDelayedLoading(events === null && !eventsFailed)

  useEffect(() => {
    if (!slug) return
    setService(null)
    setServiceError(false)
    apiCall<{ data: ServiceLookup }>('GET', `/inscription/services/lookup/${slug}`).then((result) => {
      if (result.ok) setService(result.data.data)
      else setServiceError(true)
    })
  }, [slug])

  useEffect(() => {
    if (!service) return
    setEvents(null)
    setEventsFailed(false)
    apiCall<{ data: Formation[] }>(
      'GET',
      `/inscription/events?orgId=${service.orgId}&serviceId=${service.serviceId}`,
    ).then((result) => {
      if (result.ok) setEvents(result.data.data)
      else setEventsFailed(true)
    })
  }, [service, reloadKey])

  const categories = ['Tout', ...Array.from(new Set((events ?? []).map((e) => e.category).filter((c): c is string => !!c)))]
  const formations = (events ?? []).filter((e) => category === 'Tout' || e.category === category)

  if (serviceError) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">
          Service introuvable — vérifiez le lien qui vous a été communiqué.
        </p>
      </PublicShell>
    )
  }

  if (!service) {
    return (
      <PublicShell>
        {showServiceLoading && <p className="pt-10 text-center text-sm text-ink-soft">Chargement…</p>}
      </PublicShell>
    )
  }

  return (
    <PublicShell
      header={
        <div className="md:mx-auto md:w-full md:max-w-[640px]">
          <PublicServiceHeader service={service} logoFailed={logoFailed} onLogoFail={() => setLogoFailed(true)} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-[640px]">
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`squircle shrink-0 rounded-full px-[15px] py-[9px] text-[12.5px] font-semibold transition ${
                  category === c ? 'bg-aregie-deep text-white' : 'bg-[oklch(0.95_0.01_260)] text-[oklch(0.42_0.02_260)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {eventsFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
        {!eventsFailed && showEventsLoading && <p className="text-sm text-ink-soft">Chargement des formations…</p>}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col gap-3"
        >
          {formations.map((f) => (
            <FormationCard key={f.id} formation={f} to={`/inscription/${slug}/f/${f.slug}`} />
          ))}
          {!eventsFailed && !showEventsLoading && formations.length === 0 && (
            <p className="pt-6 text-center text-sm text-ink-soft">Aucune formation dans cette catégorie.</p>
          )}
        </motion.div>
      </div>
    </PublicShell>
  )
}

export default PublicInscriptionCataloguePage
