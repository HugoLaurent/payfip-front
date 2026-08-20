import { useEffect, useState } from 'react'
import { ScanLine, Ticket, TrendingUp } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card } from '@/components/ui'
import type { AuthState } from '@/lib/types'

interface MonthStats {
  monthRevenueCents: number
  monthTicketsSold: number
  monthTicketsScanned: number
}

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

export function Dashboard({ auth }: { auth: AuthState }) {
  const hasBilletterie = auth.services.some((s) => s.serviceType === 'billetterie')
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)

  useEffect(() => {
    if (hasBilletterie) {
      apiCall<{ data: MonthStats }>('GET', '/billetterie/orders/stats', { token: auth.token }).then(
        (result) => {
          if (result.ok) setMonthStats(result.data.data)
        }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-aregie-blue">{greeting()} 👋</p>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">{auth.orgName}</h1>

      {hasBilletterie && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Ce mois-ci · {auth.role === 'admin' ? 'tous services' : 'vos services'}
          </p>

          <Card className="mb-3">
            <div className="flex items-center gap-2 text-gray-500">
              <TrendingUp size={16} className="text-aregie-blue" />
              <p className="text-sm">Chiffre d'affaires</p>
            </div>
            <p className="mt-1 text-4xl font-bold tracking-tight text-gray-900">
              {monthStats ? euros(monthStats.monthRevenueCents) : '…'}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aregie-deep/10 text-aregie-deep">
                <Ticket size={18} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {monthStats ? monthStats.monthTicketsSold : '…'}
                </p>
                <p className="text-xs text-gray-500">Billets vendus</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ScanLine size={18} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">
                  {monthStats ? monthStats.monthTicketsScanned : '…'}
                </p>
                <p className="text-xs text-gray-500">Billets scannés</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
