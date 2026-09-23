import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui'

// Coquille commune aux 8 vues du panel staff (organismes, services,
// utilisateurs, commandes, factures, inscriptions, demandes de paiement,
// emails) — même lecture seule tabulaire partout, seules les colonnes/
// lignes changent. `toolbar` (recherche/filtres) et `footer` (pagination)
// vivent dans la même carte que le tableau, plutôt que dans des blocs
// séparés, pour suivre la refonte "1d" (une seule surface par page).
export function StaffTable({
  headers,
  children,
  toolbar,
  footer,
}: {
  headers: string[]
  children: ReactNode
  toolbar?: ReactNode
  footer?: ReactNode
}) {
  return (
    // Fondu à l'apparition : StaffTable ne se monte qu'une fois les
    // vraies données là (juste après StaffTableSkeleton), donc ce
    // initial/animate se déclenche naturellement à chaque bascule
    // squelette → contenu réel, sans logique de chargement à gérer ici.
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <Card className="overflow-hidden p-0">
        {toolbar && (
          <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-4 py-3">{toolbar}</div>
        )}
        {/* max-h + overflow-y-auto ici plutôt que de laisser le tableau
            grandir sans limite avec le nombre de lignes — sinon toute la
            page (bannière comprise) défile hors de l'écran sur les pages
            avec beaucoup de résultats. thead sticky pour rester lisible
            pendant le défilement des lignes. */}
        <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-gray-100">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
        {footer && <div className="border-t border-gray-100 px-4 py-3">{footer}</div>}
      </Card>
    </motion.div>
  )
}

// Occupe la même carte/hauteur que le vrai StaffTable pendant le premier
// chargement, affiché immédiatement (pas de délai type useDelayedLoading)
// — sinon la zone de contenu reste vide pendant tout le fetch (la plupart
// reviennent en quelques centaines de ms, sous le délai d'1s au-delà
// duquel "Chargement…" s'affichait) puis le tableau entier surgit d'un
// coup. `columns` doit correspondre au nombre d'en-têtes de la page pour
// que la largeur ne saute pas non plus au moment du remplacement.
export function StaffTableSkeleton({
  columns,
  rows = 5,
  toolbar = true,
}: {
  columns: number
  rows?: number
  toolbar?: boolean
}) {
  return (
    <Card className="overflow-hidden p-0">
      {toolbar && (
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          <div className="h-8 w-52 animate-pulse rounded-full bg-gray-100" />
        </div>
      )}
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, col) => (
              <div key={col} className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}

export function StaffRow({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/60 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </tr>
  )
}

const SUCCESS_STATUSES = new Set(['confirmed', 'paid', 'sent', 'active'])
const FAILURE_STATUSES = new Set(['cancelled', 'failed', 'expired'])

// Les statuts diffèrent par domaine (commandes/factures/paiements/emails)
// mais suivent tous la même intuition succès/échec/en cours — un mapping
// générique évite de redéfinir des palettes de couleurs par page pour un
// simple badge de lecture seule.
export function genericStatusTint(status: string): string {
  if (SUCCESS_STATUSES.has(status)) return 'bg-emerald-100 text-emerald-700'
  if (FAILURE_STATUSES.has(status)) return 'bg-red-100 text-red-600'
  return 'bg-gray-100 text-gray-600'
}
