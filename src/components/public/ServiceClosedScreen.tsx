import { Clock } from 'lucide-react'
import { PublicShell } from '@/layouts/PublicShell'
import { PublicServiceHeader } from './PublicServiceHeader'
import type { ServiceLookup } from '@/lib/types'

function formatReopenLabel(iso: string): string {
  const date = new Date(iso)
  const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${dayLabel} à ${timeLabel}`
}

// Écran bloquant affiché à la place du parcours d'achat/facture quand le
// service est hors horaires ou en pleine période de fermeture — la
// disponibilité vient déjà calculée de svc-auth (voir
// service_availability_service.ts côté back), pas recalculée ici.
export function ServiceClosedScreen({
  service,
  logoFailed,
  onLogoFail,
}: {
  service: ServiceLookup
  logoFailed: boolean
  onLogoFail: () => void
}) {
  return (
    <PublicShell
      header={
        <div className="md:mx-auto md:w-full md:max-w-md">
          <PublicServiceHeader service={service} logoFailed={logoFailed} onLogoFail={onLogoFail} />
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 pt-10 text-center md:mx-auto md:max-w-md">
        <div className="squircle flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
          <Clock size={24} />
        </div>
        <p className="text-lg font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          Service fermé
        </p>
        <p className="text-sm text-ink-soft">
          {service.closedMessage ||
            (service.closedReason
              ? `Fermé pour ${service.closedReason}.`
              : "Ce service n'est pas ouvert actuellement.")}
          {service.reopensAt && (
            <>
              <br />
              Réouvre le {formatReopenLabel(service.reopensAt)}.
            </>
          )}
        </p>
      </div>
    </PublicShell>
  )
}
