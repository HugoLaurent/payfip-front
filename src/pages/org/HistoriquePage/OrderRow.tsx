import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Globe, Printer, User } from 'lucide-react'
import { Card, LoadError, SecondaryButton, StatusBadge } from '@/components/ui'
import { euros } from '@/lib/format'
import type { PaymentAttempt } from '@/lib/types'
import { STATUS_LABELS, STATUS_TINTS, TICKET_STATUS_LABELS, type Order } from './types'

export function OrderRow({
  order,
  index,
  expanded,
  onToggle,
  canSell,
  canScan,
  pdfLoadingId,
  pdfErrorId,
  onOpenPdf,
  attempts,
  attemptsFailed,
  showAttemptsLoading,
  onRetryAttempts,
  refundingId,
  onRefund,
}: {
  order: Order
  index: number
  expanded: boolean
  onToggle: (order: Order) => void
  canSell: boolean
  canScan: boolean
  pdfLoadingId: number | null
  pdfErrorId: number | null
  onOpenPdf: (orderId: number) => void
  attempts: PaymentAttempt[] | null
  attemptsFailed: boolean
  showAttemptsLoading: boolean
  onRetryAttempts: (order: Order) => void
  refundingId: number | null
  onRefund: (ticketId: number) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(index, 6) * 0.02 }}
    >
      <Card className="p-0 px-5 py-2">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => onToggle(order)}
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
                onClick={() => onOpenPdf(order.id)}
                disabled={pdfLoadingId === order.id}
                className="flex h-7 w-7 items-center justify-center squircle rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-aregie-deep disabled:opacity-40"
              >
                <Printer size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggle(order)}
              className="flex items-center gap-3"
            >
              <StatusBadge
                label={STATUS_LABELS[order.status] ?? order.status}
                className={STATUS_TINTS[order.status] ?? 'bg-gray-100 text-gray-600'}
              />
              {expanded ? (
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
          {expanded && (
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
                      <div key={t.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span className="text-gray-600">{t.tariffType}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-400">
                            {t.status === 'consumed'
                              ? `Scanné par ${t.consumedByLabel ?? 'un agent'}`
                              : t.status === 'refunded'
                                ? `Remboursé par ${t.refundedByLabel ?? 'un agent'}`
                                : TICKET_STATUS_LABELS[t.status] ?? t.status}
                          </span>
                          {canScan && (t.status === 'issued' || t.status === 'consumed') && (
                            <SecondaryButton
                              type="button"
                              onClick={() => onRefund(t.id)}
                              disabled={refundingId === t.id}
                              className="px-2.5 py-1 text-xs"
                            >
                              {refundingId === t.id ? '…' : 'Rembourser'}
                            </SecondaryButton>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Paiement
                  </p>
                  {attemptsFailed && <LoadError onRetry={() => onRetryAttempts(order)} />}
                  {!attemptsFailed && showAttemptsLoading && (
                    <div className="space-y-2 py-1">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-gray-100" />
                      <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100" />
                    </div>
                  )}
                  {!attemptsFailed && !showAttemptsLoading && attempts?.length === 0 && (
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
    </motion.div>
  )
}
