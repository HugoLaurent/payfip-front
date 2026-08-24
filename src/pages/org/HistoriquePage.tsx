import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Globe, History, Printer, Search, User } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { Card, EmptyState, LoadError, PageHeader, Pagination, SelectInput, StatusBadge, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useAuth } from '@/lib/useAuth'
import { euros } from '@/lib/format'
import type { PageMeta } from '@/lib/types'

interface OrderTicket {
  id: number
  tariffType: string
  status: string
  consumedAt: string | null
  consumedByLabel: string | null
}

interface Order {
  id: number
  paymentReference: string | null
  createdAt: string
  visitDate: string
  email: string
  qtyTickets: number
  totalAmountCents: number
  status: string
  paymentMethod: string
  soldBy: string | null
  consumedCount: number
  retryCount: number
  tickets: OrderTicket[]
}

interface PaymentAttempt {
  id: number
  status: string
  createdAt: string
  paidAt: string | null
  isRetry: boolean
}

interface ScanEntry {
  id: number
  result: string
  reason: string | null
  agentLabel: string | null
  tariffType: string | null
  email: string | null
  paymentReference: string | null
  createdAt: string
}

const SCAN_RESULT_LABELS: Record<string, string> = {
  valid: 'Validé',
  already_consumed: 'Déjà scanné',
  invalid_date: 'Mauvaise date',
  not_found: 'Introuvable',
  invalid_signature: 'Code illisible',
  other: 'Refusé',
  reset: 'Remis en attente',
}

const SCAN_RESULT_TINTS: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-700',
  reset: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
}

const STATUS_TINTS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  issued: 'Non scanné',
  refunded: 'Remboursé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

const PER_PAGE = 10

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function HistoriquePage() {
  const { auth } = useAuth()
  const visibleServices = auth.services.filter(
    (s) => s.serviceType === 'billetterie' && (auth.role === 'admin' || s.permissions?.canViewHistory)
  )

  const [tab, setTab] = useState<'orders' | 'scans'>('orders')
  const [serviceId, setServiceId] = useState<number | null>(visibleServices[0]?.id ?? null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  // Par défaut on ne montre que les commandes du jour — l'agent veut
  // surtout voir ce qui vient de se passer, pas tout l'historique.
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [page, setPage] = useState(1)

  const {
    data: orders,
    meta,
    loadFailed,
    showLoading: showOrdersLoading,
    reload: reloadOrders,
  } = usePaginatedResource<Order, PageMeta>({
    fetcher: () => {
      const qs = new URLSearchParams({
        serviceId: String(serviceId),
        page: String(page),
        perPage: String(PER_PAGE),
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })
      return apiCall('GET', `/billetterie/orders?${qs}`, { token: auth.token })
    },
    deps: [tab, auth.token, serviceId, q, status, dateFrom, dateTo, page],
    enabled: tab === 'orders' && serviceId !== null,
  })

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [attempts, setAttempts] = useState<PaymentAttempt[] | null>(null)
  const [attemptsFailed, setAttemptsFailed] = useState(false)
  const showAttemptsLoading = useDelayedLoading(attempts === null)
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null)
  const [pdfErrorId, setPdfErrorId] = useState<number | null>(null)

  const [scansPage, setScansPage] = useState(1)
  const {
    data: scans,
    meta: scansMeta,
    loadFailed: scansFailed,
    showLoading: showScansLoading,
    reload: reloadScans,
  } = usePaginatedResource<ScanEntry, PageMeta>({
    fetcher: () => {
      const qs = new URLSearchParams({
        serviceId: String(serviceId),
        page: String(scansPage),
        perPage: String(PER_PAGE),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })
      return apiCall('GET', `/billetterie/scans?${qs}`, { token: auth.token })
    },
    deps: [tab, auth.token, serviceId, dateFrom, dateTo, scansPage],
    enabled: tab === 'scans' && serviceId !== null,
  })

  const currentService = auth.services.find((s) => s.id === serviceId)
  const canSell = auth.role === 'admin' || currentService?.permissions?.canSell === true

  const isDefaultRange = dateFrom === todayISO() && dateTo === todayISO()

  useEffect(() => {
    // Chercher un email ou un n° de commande n'a pas de raison de se
    // limiter à aujourd'hui — mais si l'agent a déjà choisi une plage de
    // dates volontairement, on la respecte et on ne touche à rien.
    if (q && dateFrom === todayISO() && dateTo === todayISO()) {
      setDateFrom('')
      setDateTo('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function loadAttempts(order: Order) {
    setAttemptsFailed(false)

    // L'écran ne sert qu'à comparer plusieurs tentatives ("le client a
    // payé deux fois ?") — sans retry, il n'y a jamais qu'une tentative
    // au plus (ou aucune, pour une vente agent), rien d'utile à
    // afficher. Pas la peine d'appeler svc-gestion pour le savoir.
    if (order.retryCount === 0) {
      setAttempts([])
      return
    }

    setAttempts(null)
    const result = await apiCall<{ data: PaymentAttempt[] }>(
      'GET',
      `/billetterie/orders/${order.id}/payment-attempts`,
      { token: auth.token }
    )
    if (result.ok) setAttempts(result.data.data)
    else setAttemptsFailed(true)
  }

  function toggleAttempts(order: Order) {
    if (expandedId === order.id) {
      setExpandedId(null)
      setAttempts(null)
      return
    }
    setExpandedId(order.id)
    loadAttempts(order)
  }

  async function openTicketsPdf(orderId: number) {
    setPdfErrorId(null)
    setPdfLoadingId(orderId)

    const res = await fetch(`${GATEWAY_URL}/billetterie/orders/${orderId}/agent-tickets-pdf`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })

    setPdfLoadingId(null)

    if (!res.ok) {
      setPdfErrorId(orderId)
      return
    }

    const blob = await res.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  if (visibleServices.length === 0) {
    return (
      <div>
        <PageHeader icon={<History size={20} />} title="Historique" subtitle={auth.orgName} />
        <p className="text-sm text-gray-500">Aucun service accessible.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon={<History size={20} />} title="Historique" subtitle={auth.orgName} />

      <div className="mb-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
            tab === 'orders' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Commandes
        </button>
        <button
          type="button"
          onClick={() => setTab('scans')}
          className={`squircle rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
            tab === 'scans' ? 'bg-aregie-deep text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Scans
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {visibleServices.length > 1 && (
          <div className="w-full shrink-0 sm:w-44">
            <SelectInput
              value={serviceId ?? ''}
              onChange={(e) => {
                setServiceId(Number(e.target.value))
                setPage(1)
              }}
            >
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </div>
        )}

        {tab === 'orders' && (
          <div className="w-full shrink-0 sm:w-40">
            <SelectInput
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </div>
        )}

        <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-[136px] sm:flex-none">
            <TextInput
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <span className="text-gray-300">→</span>
          <div className="min-w-0 flex-1 sm:w-[136px] sm:flex-none">
            <TextInput
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
            />
          </div>
          {!isDefaultRange && (
            <button
              type="button"
              onClick={() => {
                setDateFrom(todayISO())
                setDateTo(todayISO())
                setPage(1)
              }}
              className="shrink-0 whitespace-nowrap squircle rounded-lg px-2 py-2 text-xs font-medium text-aregie-deep hover:bg-aregie-tint/10"
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {tab === 'orders' && (
          <div className="relative w-full min-w-0 flex-1 sm:min-w-[200px]">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <TextInput
              placeholder="Rechercher (email, n° de commande)…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {tab === 'scans' ? (
        <div className="space-y-2">
          {scansFailed && <LoadError onRetry={reloadScans} />}
          {!scansFailed && showScansLoading && <p className="text-sm text-gray-500">Chargement…</p>}
          {!scansFailed && scans?.length === 0 && (
            <EmptyState icon={<History size={28} />} label="Aucun scan." />
          )}
          {scans?.map((s) => (
            <Card key={s.id} className="p-0 px-5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={SCAN_RESULT_LABELS[s.result] ?? s.result}
                      className={SCAN_RESULT_TINTS[s.result] ?? 'bg-red-100 text-red-600'}
                    />
                    {s.tariffType && <span className="truncate text-sm text-gray-700">{s.tariffType}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-gray-400">
                    {s.agentLabel ? `Par ${s.agentLabel}` : 'Agent inconnu'}
                    {s.email && ` · ${s.email}`}
                    {s.paymentReference && ` · ${s.paymentReference}`}
                    {s.reason && ` · ${s.reason}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(s.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
      <div className="space-y-2">
        {loadFailed && <LoadError onRetry={reloadOrders} />}
        {!loadFailed && showOrdersLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && orders?.length === 0 && (
          <EmptyState icon={<History size={28} />} label="Aucune commande." />
        )}
        {orders?.map((order) => (
          <Card key={order.id} className="p-0 px-5 py-2">
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => toggleAttempts(order)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{order.email}</p>
                  {order.paymentReference && (
                    <span className="shrink-0 font-mono text-[11px] text-gray-400">
                      {order.paymentReference}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-gray-400">
                  {order.qtyTickets} billet{order.qtyTickets > 1 ? 's' : ''} · {euros(order.totalAmountCents)} ·
                  visite le {order.visitDate}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-2 pl-3">
                {order.status === 'confirmed' && canSell && (
                  <button
                    type="button"
                    title="Voir / réimprimer les billets"
                    onClick={() => openTicketsPdf(order.id)}
                    disabled={pdfLoadingId === order.id}
                    className="flex h-7 w-7 items-center justify-center squircle rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-aregie-deep disabled:opacity-40"
                  >
                    <Printer size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleAttempts(order)}
                  className="flex items-center gap-3"
                >
                  <StatusBadge
                    label={STATUS_LABELS[order.status] ?? order.status}
                    className={STATUS_TINTS[order.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                  {expandedId === order.id ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {pdfErrorId === order.id && (
              <p className="border-t border-gray-100 py-2 text-xs text-red-500">
                Échec du chargement des billets.
              </p>
            )}

            <AnimatePresence initial={false}>
              {expandedId === order.id && (
                <motion.div
                  key="expand"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-gray-100 py-3">
                    {(order.soldBy || order.paymentMethod === 'payfip') && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        {order.soldBy ? <User size={13} /> : <Globe size={13} />}
                        {order.soldBy ?? 'Achat en ligne'}
                      </div>
                    )}

                    {order.tickets.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                          Billets
                        </p>
                        {order.tickets.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-gray-600">{t.tariffType}</span>
                            <span className="text-gray-400">
                              {t.status === 'consumed'
                                ? `Scanné par ${t.consumedByLabel ?? 'un agent'}`
                                : TICKET_STATUS_LABELS[t.status] ?? t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                        Paiement
                      </p>
                      {attemptsFailed && <LoadError onRetry={() => loadAttempts(order)} />}
                      {!attemptsFailed && showAttemptsLoading && (
                        <p className="text-sm text-gray-500">Chargement…</p>
                      )}
                      {!attemptsFailed && attempts?.length === 0 && (
                        <p className="text-sm text-gray-400">Aucune tentative de paiement enregistrée.</p>
                      )}
                      {attempts?.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-gray-600">
                            {a.isRetry ? 'Nouvelle tentative' : 'Tentative'} — {a.status}
                          </span>
                          <span className="text-gray-400">{a.paidAt ?? a.createdAt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
      )}

      {tab === 'orders' && meta && meta.lastPage > 1 && (
        <Card className="mt-4">
          <Pagination
            currentPage={meta.currentPage}
            lastPage={meta.lastPage}
            total={meta.total}
            onChange={setPage}
          />
        </Card>
      )}

      {tab === 'scans' && scansMeta && scansMeta.lastPage > 1 && (
        <Card className="mt-4">
          <Pagination
            currentPage={scansMeta.currentPage}
            lastPage={scansMeta.lastPage}
            total={scansMeta.total}
            onChange={setScansPage}
          />
        </Card>
      )}
    </div>
  )
}

export default HistoriquePage
