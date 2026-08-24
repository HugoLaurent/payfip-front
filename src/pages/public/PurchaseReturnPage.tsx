import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { CheckCircle2, Loader2, Printer } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { LoadError } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { usePaymentStatusPolling, isPendingPaymentStatus } from '@/lib/usePaymentStatusPolling'
import { euros } from '@/lib/format'
import type { ServiceLookup } from '@/lib/types'
import { PublicShell } from '@/layouts/PublicShell'
import { FadeIn, PaymentFailedState, PaymentPendingState, PublicButton } from '@/components/public'

type PaymentStatus = 'draft' | 'awaiting_payment' | 'paid' | 'confirmed' | 'failed' | 'cancelled' | 'expired'

interface Ticket {
  id: number
  tariffType: string
  priceAtPurchaseCents: number
  visitDate: string
  status: string
  code: string
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Paiement en préparation…',
  awaiting_payment: 'Vérification du paiement…',
  paid: 'Paiement confirmé',
  confirmed: 'Réservation confirmée',
  failed: 'Le paiement a échoué',
  cancelled: 'Paiement annulé',
  expired: 'Le délai de paiement a expiré',
}

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function PurchaseReturnPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const idop = searchParams.get('idop')
  const orgId = searchParams.get('orgId')
  const sourceReference = searchParams.get('sourceReference')
  const initialStatus = (searchParams.get('status') as PaymentStatus | null) ?? null
  const confirmedMessage = searchParams.get('message')
  const confirmedEmail = searchParams.get('email')

  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [orderCode, setOrderCode] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [ticketsFailed, setTicketsFailed] = useState(false)
  const showTicketsLoading = useDelayedLoading(tickets === null && !ticketsFailed)
  const [pdfError, setPdfError] = useState(false)

  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const [service, setService] = useState<ServiceLookup | null>(null)

  const missingParams = !idop || !orgId || !sourceReference || !initialStatus
  const { status, maxAttemptsReached } = usePaymentStatusPolling<PaymentStatus>({
    idop,
    missingParams,
    initialStatus,
  })

  useEffect(() => {
    if (!slug) return
    apiCall<{ data: ServiceLookup }>('GET', `/billetterie/services/lookup/${slug}`).then((result) => {
      if (result.ok) setService(result.data.data)
    })
  }, [slug])

  useEffect(() => {
    if (missingParams || (status !== 'paid' && status !== 'confirmed')) return
    setTickets(null)
    setTicketsFailed(false)
    apiCall<{ data: { tickets: Ticket[]; orderCode: string } }>(
      'GET',
      `/billetterie/orders/by-reference/${sourceReference}/tickets?orgId=${orgId}&idop=${idop}`
    ).then((result) => {
      if (result.ok) {
        setTickets(result.data.data.tickets)
        setOrderCode(result.data.data.orderCode)
      } else {
        setTicketsFailed(true)
      }
    })
  }, [status, missingParams, sourceReference, orgId, idop])

  useEffect(() => {
    if (!orderCode) return
    QRCode.toDataURL(orderCode, { margin: 1, width: 200 }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
  }, [orderCode])

  async function handleDownloadAll() {
    setPdfError(false)
    const res = await fetch(
      `${GATEWAY_URL}/billetterie/orders/by-reference/${sourceReference}/tickets/pdf?orgId=${orgId}&idop=${idop}`
    )
    if (!res.ok) {
      setPdfError(true)
      return
    }
    const blob = await res.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  async function handleRetry() {
    if (!slug) return
    setRetrying(true)
    setRetryError(null)
    const result = await apiCall<{ data: { paymentUrl: string } }>(
      'POST',
      `/billetterie/orders/by-reference/${sourceReference}/retry-payment?orgId=${orgId}&idop=${idop}`,
      { body: { frontRedirectUrl: `${window.location.origin}/billetterie/${slug}/retour` } }
    )
    if (result.ok) {
      window.location.href = result.data.data.paymentUrl
      return
    }
    setRetrying(false)
    if (result.status === 409) {
      setRetryError("Cette commande n'est plus modifiable — contactez l'organisme.")
    } else {
      setRetryError('Échec de la nouvelle tentative de paiement.')
    }
  }

  const purchasedRows = tickets
    ? Object.values(
        tickets.reduce<Record<string, { label: string; count: number; cents: number }>>((acc, t) => {
          const row = acc[t.tariffType] ?? { label: t.tariffType, count: 0, cents: 0 }
          row.count += 1
          row.cents += t.priceAtPurchaseCents
          acc[t.tariffType] = row
          return acc
        }, {})
      )
    : []
  const totalCents = purchasedRows.reduce((sum, r) => sum + r.cents, 0)

  return (
    <PublicShell>
      <div className="mx-auto max-w-md space-y-4 pt-4">
        {missingParams || !status ? (
          <p className="pt-10 text-center text-sm text-ink-soft">Lien de retour de paiement invalide ou incomplet.</p>
        ) : isPendingPaymentStatus(status) ? (
          <PaymentPendingState label={STATUS_LABELS[status]} maxAttemptsReached={maxAttemptsReached} />
        ) : status === 'paid' || status === 'confirmed' ? (
          <>
            <FadeIn className="flex flex-col items-center gap-3 pt-2 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-success shadow-[0_14px_28px_-10px_oklch(0.65_0.15_150_/_0.55)]"
              >
                <CheckCircle2 size={36} strokeWidth={2.5} className="text-white" />
              </motion.div>
              <div>
                <p className="text-xl font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                  {STATUS_LABELS[status]}
                </p>
                <p className="mt-1 text-[13.5px] text-ink-soft">
                  {status === 'confirmed'
                    ? (confirmedMessage ?? "Aucun paiement n'était nécessaire.")
                    : 'Vos billets ont été envoyés'}
                  {confirmedEmail && (
                    <>
                      {status === 'paid' && ' à'}
                      <br />
                      {confirmedEmail}
                    </>
                  )}
                </p>
              </div>
              <p className="rounded-full bg-ref-tint px-4 py-2 font-mono text-xs font-bold tracking-wide text-aregie-blue">
                N° {sourceReference}
              </p>
            </FadeIn>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
              className="squircle overflow-visible rounded-[20px] bg-white p-0 shadow-[0_12px_30px_-14px_rgba(20,25,60,0.18)]"
            >
              <div className="flex flex-col gap-0.5 px-5 pt-5 pb-4">
                <p className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                  {service?.name}
                </p>
                {tickets && tickets[0] && (
                  <p className="text-[12.5px] font-medium text-ink-soft">{formatDateLabel(tickets[0].visitDate)}</p>
                )}
              </div>

              {ticketsFailed && (
                <div className="px-5 pb-4">
                  <LoadError onRetry={() => setTickets(null)} />
                </div>
              )}
              {!ticketsFailed && showTicketsLoading && (
                <p className="px-5 pb-4 text-sm text-ink-soft">Chargement…</p>
              )}

              {purchasedRows.length > 0 && (
                <div className="flex flex-col gap-2 px-5 pb-4">
                  {purchasedRows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between text-[13px] font-medium text-ink-soft">
                      <span className="capitalize">
                        {r.count} × {r.label}
                      </span>
                      <span className="font-bold text-ink">{r.cents === 0 ? 'Gratuit' : euros(r.cents)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Séparateur "ticket déchiré" : deux encoches en négatif sur les bords + trait pointillé */}
              <div className="relative h-0">
                <div className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-white" />
                <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white" />
                <div className="mx-6 border-t-2 border-dashed border-hairline" />
              </div>

              <div className="flex items-center gap-4 px-5 py-5">
                <div className="squircle flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-otp-bg">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR code de la commande" className="h-full w-full object-contain" />
                  ) : (
                    <Loader2 size={20} className="animate-spin text-ink-faint" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
                    {status === 'confirmed' ? 'Total' : 'Total réglé'}
                  </p>
                  <p className="text-2xl font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {totalCents === 0 ? 'Gratuit' : euros(totalCents)}
                  </p>
                </div>
              </div>
            </motion.div>

            {tickets && tickets.length > 0 && (
              <div className="flex flex-col items-center gap-3">
                <PublicButton type="button" onClick={handleDownloadAll} className="w-full">
                  <Printer size={16} />
                  Télécharger mes billets (PDF)
                </PublicButton>
                {pdfError && <p className="text-center text-sm text-red-600">Échec du téléchargement — réessayez.</p>}
                <Link to={`/billetterie/${slug}`} className="text-[13px] font-semibold text-ink-soft">
                  Retour à l'accueil
                </Link>
              </div>
            )}
          </>
        ) : (
          <PaymentFailedState
            expired={status === 'expired'}
            label={STATUS_LABELS[status]}
            retryError={retryError}
            retrying={retrying}
            onRetry={handleRetry}
          />
        )}
      </div>
    </PublicShell>
  )
}

export default PurchaseReturnPage
