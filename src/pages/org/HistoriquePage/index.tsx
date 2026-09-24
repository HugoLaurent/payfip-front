import { useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import { apiCall, openPdfInNewTab } from '@/lib/api'
import { Card, EmptyState, LoadError, PageHeader, Pagination, SelectInput, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import type { PageMeta, PaymentAttempt } from '@/lib/types'
import { OrderRow } from './OrderRow'
import { ScansList } from './ScansList'
import { PER_PAGE, STATUS_LABELS, todayISO, type Order, type ScanEntry } from './types'

export function HistoriquePage() {
  const { auth } = useAuth()
  const { showToast } = useToast()
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
  const canScan = auth.role === 'admin' || currentService?.permissions?.canScan === true

  const [refundingId, setRefundingId] = useState<number | null>(null)

  // Remboursement déclaratif : l'argent est rendu hors plateforme (par
  // l'organisme, directement au citoyen) — voir tickets_controller.ts#refund
  // côté svc-billetterie. Pas d'appel PayFiP ici, juste une trace de
  // qui/quand/pourquoi.
  async function handleRefund(ticketId: number) {
    const reason = window.prompt('Motif du remboursement (obligatoire, pour la traçabilité) :')
    if (!reason || !reason.trim()) return

    setRefundingId(ticketId)
    const result = await apiCall('POST', `/billetterie/tickets/${ticketId}/refund`, {
      token: auth.token,
      body: { reason: reason.trim() },
    })
    setRefundingId(null)

    if (result.ok) {
      showToast('success', 'Billet remboursé', 'Marqué comme remboursé.')
      await reloadOrders()
    } else {
      showToast('error', 'Échec', "Impossible de marquer ce billet comme remboursé.")
    }
  }

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
    const ok = await openPdfInNewTab(`/billetterie/orders/${orderId}/agent-tickets-pdf`, auth.token)
    setPdfLoadingId(null)
    if (!ok) setPdfErrorId(orderId)
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
        <ScansList
          scansFailed={scansFailed}
          showScansLoading={showScansLoading}
          scans={scans}
          reloadScans={reloadScans}
        />
      ) : (
        <div className="space-y-2">
          {loadFailed && <LoadError onRetry={reloadOrders} />}
          {!loadFailed && showOrdersLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-0 px-5 py-2">
                <div className="flex w-full items-center justify-between py-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                    </div>
                    <div className="mt-1.5 h-3 w-48 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-3">
                    <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
                  </div>
                </div>
              </Card>
            ))}
          {!loadFailed && !showOrdersLoading && orders?.length === 0 && (
            <EmptyState icon={<History size={28} />} label="Aucune commande." />
          )}
          {!showOrdersLoading && orders?.map((order, i) => (
            <OrderRow
              key={order.id}
              order={order}
              index={i}
              expanded={expandedId === order.id}
              onToggle={toggleAttempts}
              canSell={canSell}
              canScan={canScan}
              pdfLoadingId={pdfLoadingId}
              pdfErrorId={pdfErrorId}
              onOpenPdf={openTicketsPdf}
              attempts={attempts}
              attemptsFailed={attemptsFailed}
              showAttemptsLoading={showAttemptsLoading}
              onRetryAttempts={loadAttempts}
              refundingId={refundingId}
              onRefund={handleRefund}
            />
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
