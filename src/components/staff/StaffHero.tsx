import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface StaffStat {
  label: string
  // null = donnée pas encore chargée (squelette animé) — passer un tableau
  // de stats dès le premier rendu avec des value:null plutôt que stats
  // undefined le temps du chargement, pour que la bannière n'apparaisse
  // jamais "sans chiffres" puis ne saute pas de taille une fraction de
  // seconde plus tard une fois les données arrivées.
  value: string | null
  note?: string
  // Prévient StaffHero que cette stat aura une note une fois chargée,
  // indépendamment du fait qu'elle soit déjà là — sans ça, la ligne de
  // note apparaît/disparaît selon le chargement et fait varier la
  // hauteur de la carte (une source de plus du sursaut d'un pixel).
  hasNote?: boolean
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
  const LAYOUT_TRANSITION = { duration: 0.25, ease: 'easeOut' as const }

  return (
    <motion.div layout transition={LAYOUT_TRANSITION} className={hasStats ? 'mb-8' : 'mb-6'}>
      {/* Bannière pleine largeur, pas une carte : les marges négatives
          annulent exactement le padding de StaffSpace's <main> (px-4 py-6
          sm:px-6 md:px-8 md:py-8) pour que le bleu touche la sidebar et le
          haut de page comme dans la maquette "1d" — donc pas de coins
          arrondis ici (contrairement aux cartes de chiffres en dessous,
          qui elles restent arrondies). StaffSpace n'a plus de max-width
          partagé pour permettre ce plein-bord ; voir son commentaire.
          `layout` (ici et sur le bloc de chiffres en dessous) anime la
          transition en douceur au lieu du saut sec observé au chargement
          — les pages qui ont toujours des stats les passent avec des
          value:null (squelette) dès le premier rendu pour ne même pas
          déclencher ce changement de taille dans le cas courant ; il ne
          reste plus qu'aux pages où les stats dépendent d'un choix de
          l'utilisateur (ex: choisir un organisme) à réellement l'animer. */}
      <motion.div
        layout
        transition={LAYOUT_TRANSITION}
        className={`-mx-4 -mt-6 bg-aregie-deep px-4 pt-6 text-white sm:-mx-6 sm:px-6 md:-mx-8 md:-mt-8 md:px-8 md:pt-8 ${hasStats ? 'pb-10' : 'pb-6 md:pb-8'}`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-wrap items-start justify-between gap-4"
        >
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
        </motion.div>
      </motion.div>

      {hasStats && (
        <motion.div
          layout
          transition={LAYOUT_TRANSITION}
          className="grid gap-3 px-4 sm:px-6 md:px-8"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', marginTop: '-28px' }}
        >
          {stats!.map((s) => {
            const tone = TONE_CLASSES[s.tone ?? 'blue']
            const loading = s.value === null
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
                {loading ? (
                  // h-8 = 2rem, la hauteur de ligne réelle de text-2xl —
                  // même valeur exacte que le texte qui le remplace, pour
                  // que la carte ne bouge pas d'un pixel à la bascule.
                  <div className="h-8 w-14 animate-pulse rounded-md bg-gray-100" />
                ) : (
                  // Fondu sûr maintenant que le squelette fait exactement
                  // la même hauteur (h-8) que ce texte : seule l'opacité
                  // bouge, jamais la taille de la boîte.
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="text-2xl font-semibold tracking-tight text-gray-900"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {s.value}
                  </motion.p>
                )}
                {s.hasNote &&
                  (loading ? (
                    <div className="mt-1 h-3 w-20 animate-pulse rounded bg-gray-100" />
                  ) : (
                    <p className={`mt-0.5 text-[11.5px] ${tone.note}`}>{s.note}</p>
                  ))}
              </div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
