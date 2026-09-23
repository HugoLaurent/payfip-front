import type { ReactNode } from 'react'

export interface StaffStat {
  label: string
  value: string
  note?: string
  icon?: ReactNode
  tone?: 'blue' | 'green' | 'red' | 'gray'
}

const TONE_CLASSES: Record<NonNullable<StaffStat['tone']>, { bg: string; fg: string; note: string }> = {
  blue: { bg: 'bg-aregie-deep/10', fg: 'text-aregie-deep', note: 'text-gray-400' },
  green: { bg: 'bg-emerald-100', fg: 'text-emerald-700', note: 'text-emerald-700' },
  red: { bg: 'bg-red-100', fg: 'text-red-600', note: 'text-red-600' },
  gray: { bg: 'bg-gray-100', fg: 'text-gray-500', note: 'text-gray-400' },
}

// En-tête des 8 pages du panel staff (refonte "1d") — bannière bleue avec
// titre + actions, chiffres clés flottant par-dessus le bas de la bannière.
// `stats` ne doit porter que des nombres réels déjà chargés par la page
// (total paginé, comptage sur une liste déjà en mémoire…) : pas de valeur
// inventée façon maquette Claude Design, qui utilisait des chiffres fictifs
// pour illustrer le layout.
export function StaffHero({
  icon,
  eyebrow,
  title,
  actions,
  stats,
}: {
  icon?: ReactNode
  eyebrow?: string
  title: string
  actions?: ReactNode
  stats?: StaffStat[]
}) {
  const hasStats = !!stats && stats.length > 0

  return (
    <div className={hasStats ? 'mb-8' : 'mb-6'}>
      {/* Bannière pleine largeur, pas une carte : les marges négatives
          annulent exactement le padding de StaffSpace's <main> (px-4 py-6
          sm:px-6 md:px-8 md:py-8) pour que le bleu touche la sidebar et le
          haut de page comme dans la maquette "1d" — donc pas de coins
          arrondis ici (contrairement aux cartes de chiffres en dessous,
          qui elles restent arrondies). StaffSpace n'a plus de max-width
          partagé pour permettre ce plein-bord ; voir son commentaire. */}
      <div
        className={`-mx-4 -mt-6 bg-aregie-deep px-4 pt-6 text-white sm:-mx-6 sm:px-6 md:-mx-8 md:-mt-8 md:px-8 md:pt-8 ${hasStats ? 'pb-10' : 'pb-6 md:pb-8'}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/75">
                {icon}
                {eyebrow}
              </div>
            )}
            <h1
              className="truncate text-2xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h1>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>

      {hasStats && (
        <div
          className="grid gap-3 px-4 sm:px-6 md:px-8"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', marginTop: '-28px' }}
        >
          {stats!.map((s) => {
            const tone = TONE_CLASSES[s.tone ?? 'blue']
            return (
              <div
                key={s.label}
                className="squircle rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_14px_-6px_rgba(22,26,43,0.18)]"
              >
                <div className="mb-2 flex items-center gap-2">
                  {s.icon && (
                    <div
                      className={`squircle flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${tone.bg} ${tone.fg}`}
                    >
                      {s.icon}
                    </div>
                  )}
                  <p className="truncate text-[11.5px] font-medium text-gray-400">{s.label}</p>
                </div>
                <p
                  className="text-2xl font-semibold tracking-tight text-gray-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {s.value}
                </p>
                {s.note && <p className={`mt-0.5 text-[11.5px] ${tone.note}`}>{s.note}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
