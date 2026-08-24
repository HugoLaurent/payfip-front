import type { ReactNode } from 'react'
import { Card } from '@/components/ui'

// Coquille commune aux 7 vues du panel staff (organismes, services,
// utilisateurs, commandes, factures, demandes de paiement, emails) — même
// lecture seule tabulaire partout, seules les colonnes/lignes changent.
export function StaffTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
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
