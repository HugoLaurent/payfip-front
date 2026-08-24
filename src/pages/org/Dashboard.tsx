import { useEffect, useState } from 'react'
import { ScanLine, Ticket, TrendingUp } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card } from '@/components/ui'
import { useAuth } from '@/lib/useAuth'
import { euros } from '@/lib/format'

interface RecentActivityEntry {
  type: 'order' | 'scan'
  serviceId: number | null
  createdAt: string
  ticketCount?: number
  amountCents?: number
  soldBy?: string | null
  paymentReference?: string | null
}

interface TopServiceStat {
  serviceId: number
  revenueCents: number
  ticketsSold: number
}

interface MonthStats {
  monthRevenueCents: number
  monthTicketsSold: number
  monthTicketsScanned: number
  prevMonthRevenueCents: number
  dailyRevenue: { date: string; revenueCents: number }[]
  topServices: TopServiceStat[]
  recentActivity: RecentActivityEntry[]
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

function activityLabel(entry: RecentActivityEntry, serviceName: string | undefined): string {
  if (entry.type === 'scan') {
    return `1 billet scanné${serviceName ? ` — ${serviceName}` : ''}`
  }
  const count = entry.ticketCount ?? 0
  const amount = entry.amountCents ?? 0
  if (entry.soldBy) {
    return `Vente guichet — ${count} billet${count > 1 ? 's' : ''}`
  }
  return `Commande ${entry.paymentReference ?? ''} — ${amount === 0 ? 'gratuite' : euros(amount)}`
}

// Sparkline minimaliste en SVG brut — pour 14 points quotidiens, une lib
// de charts serait disproportionnée par rapport au poids qu'elle
// ajouterait au bundle du Dashboard.
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null

  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const width = 260
  const height = 40
  const step = width / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const areaCoords = [`0,${height}`, ...coords, `${width},${height}`]

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <polyline points={areaCoords.join(' ')} fill="oklch(0.85 0.06 230 / .25)" stroke="none" />
      <polyline points={coords.join(' ')} fill="none" stroke="#0080c0" strokeWidth="2.5" />
    </svg>
  )
}

export function Dashboard() {
  const { auth } = useAuth()
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

  function serviceName(id: number | null): string | undefined {
    return id === null ? undefined : auth.services.find((s) => s.id === id)?.name
  }

  const deltaPercent =
    monthStats && monthStats.prevMonthRevenueCents > 0
      ? Math.round(
          ((monthStats.monthRevenueCents - monthStats.prevMonthRevenueCents) /
            monthStats.prevMonthRevenueCents) *
            100
        )
      : null

  const maxTopServiceRevenue = Math.max(
    1,
    ...(monthStats?.topServices.map((s) => s.revenueCents) ?? [1])
  )

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-aregie-blue">{greeting()} 👋</p>
      <h1
        className="mb-6 text-2xl font-bold text-gray-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {auth.orgName}
      </h1>

      {hasBilletterie && (
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Ce mois-ci · {auth.role === 'admin' ? 'tous services' : 'vos services'}
          </p>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <Card>
              <div className="flex items-center gap-2 text-gray-500">
                <TrendingUp size={16} className="text-aregie-blue" />
                <p className="text-sm">Chiffre d'affaires</p>
              </div>
              <p
                className="mt-1 text-4xl font-bold tracking-tight text-gray-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {monthStats ? euros(monthStats.monthRevenueCents) : '…'}
              </p>
              {monthStats && monthStats.dailyRevenue.length > 1 && (
                <div className="mt-2">
                  <Sparkline points={monthStats.dailyRevenue.map((d) => d.revenueCents)} />
                </div>
              )}
              {deltaPercent !== null && (
                <p
                  className={`mt-1 text-xs font-semibold ${deltaPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {deltaPercent >= 0 ? '+' : ''}
                  {deltaPercent} % vs mois dernier
                </p>
              )}
            </Card>

            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center squircle rounded-xl bg-aregie-deep/10 text-aregie-deep">
                <Ticket size={18} />
              </div>
              <div>
                <p
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {monthStats ? monthStats.monthTicketsSold : '…'}
                </p>
                <p className="text-xs text-gray-500">Billets vendus</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center squircle rounded-xl bg-emerald-100 text-emerald-700">
                <ScanLine size={18} />
              </div>
              <div>
                <p
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {monthStats ? monthStats.monthTicketsScanned : '…'}
                </p>
                <p className="text-xs text-gray-500">Billets scannés</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {monthStats && monthStats.topServices.length > 0 && (
            <Card>
              <p
                className="mb-3 text-sm font-bold text-gray-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Top services
              </p>
              <div className="space-y-3">
                {monthStats.topServices.map((s) => (
                  <div key={s.serviceId}>
                    <div className="mb-1 flex justify-between gap-2 text-xs font-medium text-gray-600">
                      <span className="truncate">
                        {serviceName(s.serviceId) ?? `Service #${s.serviceId}`}
                      </span>
                      <span className="shrink-0 font-bold text-gray-900">
                        {euros(s.revenueCents)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-aregie-deep"
                        style={{
                          width: `${Math.max(4, (s.revenueCents / maxTopServiceRevenue) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {monthStats && monthStats.recentActivity.length > 0 && (
            <Card>
              <p
                className="mb-3 text-sm font-bold text-gray-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Activité récente
              </p>
              <div className="space-y-2.5">
                {monthStats.recentActivity.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${entry.type === 'scan' ? 'bg-emerald-500' : 'bg-aregie-blue'}`}
                    />
                    <p className="flex-1 truncate text-[13px] font-medium text-gray-600">
                      {activityLabel(entry, serviceName(entry.serviceId))}
                    </p>
                    <p className="shrink-0 text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
