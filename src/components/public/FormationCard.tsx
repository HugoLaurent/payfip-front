import { Link } from 'react-router-dom'
import type { Formation } from '@/lib/types'
import { euros, formatDateLabel } from '@/lib/format'

// Carte catalogue — le compteur de places est un badge vert (premier
// critère de décision), une formation complète reste cliquable pour la
// liste d'attente mais visuellement dévitalisée (voir maquette écran A1).
export function FormationCard({ formation, to }: { formation: Formation; to: string }) {
  const full = formation.isFull
  const dateLine = [
    formation.eventDate ? formatDateLabel(formation.eventDate) : null,
    formation.timeLabel,
    formation.location,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={to}
      className={`squircle flex flex-col gap-[10px] rounded-[18px] border-[1.5px] border-hairline px-[18px] py-4 transition hover:border-aregie-blue/40 ${
        full ? 'bg-[oklch(0.985_0.004_260)]' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[16.5px] leading-[1.3] font-bold ${full ? 'text-[oklch(0.45_0.02_260)]' : 'text-ink'}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formation.title}
          </p>
          {dateLine && (
            <p
              className={`pt-1 text-[12.5px] leading-[1.4] font-medium ${full ? 'text-[oklch(0.58_0.012_260)]' : 'text-ink-soft'}`}
            >
              {dateLine}
            </p>
          )}
        </div>
        <p
          className={`shrink-0 text-[17px] leading-[1.2] font-bold ${
            full ? 'text-ink-soft' : formation.priceCents === 0 ? 'text-success' : 'text-aregie-deep'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formation.priceCents === 0 ? 'Gratuit' : euros(formation.priceCents)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {full ? (
          <span className="rounded-full bg-[oklch(0.93_0.008_260)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[oklch(0.45_0.015_260)]">
            Complet · liste d'attente
          </span>
        ) : formation.seatsRemaining !== null ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success-tint px-[11px] py-[6px] text-[11.5px] font-semibold text-[oklch(0.44_0.08_150)]">
            <span className="h-[7px] w-[7px] rounded-full bg-success" />
            Il reste {formation.seatsRemaining} place{formation.seatsRemaining > 1 ? 's' : ''}
          </span>
        ) : null}
        {formation.requiresDocuments && !full && (
          <span className="rounded-full bg-[oklch(0.95_0.02_265)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[oklch(0.42_0.08_265)]">
            Justificatif requis
          </span>
        )}
      </div>
    </Link>
  )
}
