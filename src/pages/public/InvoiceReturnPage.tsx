import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useSquircle } from '@/lib/useSquircle'
import type { ServiceLookup } from '@/lib/types'
import { PublicShell } from '@/layouts/PublicShell'
import { FadeIn, PublicGhostButton } from '@/components/public'

type PaymentStatus = 'draft' | 'awaiting_payment' | 'paid' | 'failed' | 'cancelled' | 'expired'

interface InvoiceSummary {
  id: number
  status: string
  amountCents: number
  objectLabel: string
  clientNumber: string | null
  fiscalYear: number
  payerEmail: string | null
  collectedAt: string | null
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Paiement en préparation…',
  awaiting_payment: 'Vérification du paiement…',
  paid: 'Facture réglée',
  failed: 'Le paiement a échoué',
  cancelled: 'Paiement annulé',
  expired: 'Le délai de paiement a expiré',
}

// Le callback du gateway résout normalement le paiement avant de
// rediriger ici — ce polling n'est qu'un filet de sécurité si le statut
// arrive encore en transition (draft/awaiting_payment).
const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 6

function isPending(status: PaymentStatus): boolean {
  return status === 'draft' || status === 'awaiting_payment'
}

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`
}

export function InvoiceReturnPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const idop = searchParams.get('idop')
  const orgId = searchParams.get('orgId')
  const sourceReference = searchParams.get('sourceReference')
  const initialStatus = (searchParams.get('status') as PaymentStatus | null) ?? null

  const [status, setStatus] = useState<PaymentStatus | null>(initialStatus)
  const [pollAttempts, setPollAttempts] = useState(0)

  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null)
  const [invoiceFailed, setInvoiceFailed] = useState(false)
  const showInvoiceLoading = useDelayedLoading(invoice === null && !invoiceFailed)

  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const [service, setService] = useState<ServiceLookup | null>(null)

  const invoiceCardSquircle = useSquircle<HTMLDivElement>(20)

  const missingParams = !idop || !orgId || !sourceReference || !initialStatus

  useEffect(() => {
    if (!slug) return
    apiCall<{ data: ServiceLookup }>('GET', `/factures/services/lookup/${slug}`).then((result) => {
      if (result.ok) setService(result.data.data)
    })
  }, [slug])

  useEffect(() => {
    if (missingParams || !status || !isPending(status) || pollAttempts >= POLL_MAX_ATTEMPTS) return

    const timeout = setTimeout(async () => {
      const result = await apiCall<{ data: { status: PaymentStatus } }>('GET', `/paiement/status/${idop}`)
      if (result.ok) setStatus(result.data.data.status)
      setPollAttempts((n) => n + 1)
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timeout)
  }, [status, pollAttempts, missingParams, idop])

  useEffect(() => {
    if (missingParams || status !== 'paid') return
    setInvoice(null)
    setInvoiceFailed(false)
    apiCall<{ data: InvoiceSummary }>(
      'GET',
      `/factures/by-reference/${sourceReference}?orgId=${orgId}&idop=${idop}`
    ).then((result) => {
      if (result.ok) setInvoice(result.data.data)
      else setInvoiceFailed(true)
    })
  }, [status, missingParams, sourceReference, orgId, idop])

  async function handleRetry() {
    if (!slug) return
    setRetrying(true)
    setRetryError(null)
    const result = await apiCall<{ data: { paymentUrl: string } }>(
      'POST',
      `/factures/by-reference/${sourceReference}/retry-payment?orgId=${orgId}&idop=${idop}`,
      { body: { frontRedirectUrl: `${window.location.origin}/factures/${slug}/retour` } }
    )
    if (result.ok) {
      window.location.href = result.data.data.paymentUrl
      return
    }
    setRetrying(false)
    if (result.status === 409) {
      setRetryError("Cette facture n'est plus modifiable — contactez l'organisme.")
    } else {
      setRetryError('Échec de la nouvelle tentative de paiement.')
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-md space-y-4 pt-4">
        {missingParams || !status ? (
          <p className="pt-10 text-center text-sm text-ink-soft">Lien de retour de paiement invalide ou incomplet.</p>
        ) : isPending(status) ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 size={28} className="animate-spin text-aregie-deep" />
            <p className="text-sm font-medium text-ink-soft">{STATUS_LABELS[status]}</p>
            {pollAttempts >= POLL_MAX_ATTEMPTS && (
              <p className="text-xs text-ink-faint">
                Ça prend plus de temps que prévu — rechargez cette page dans quelques instants.
              </p>
            )}
          </div>
        ) : status === 'paid' ? (
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
                  {invoice?.payerEmail ? (
                    <>
                      Un email de confirmation vous a été envoyé
                      <br />
                      {invoice.payerEmail}
                    </>
                  ) : (
                    'Un email de confirmation vous a été envoyé.'
                  )}
                </p>
              </div>
              <p className="rounded-full bg-ref-tint px-4 py-2 font-mono text-xs font-bold tracking-wide text-aregie-blue">
                N° {sourceReference}
              </p>
            </FadeIn>

            <motion.div
              ref={invoiceCardSquircle.ref}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
              style={invoiceCardSquircle.style}
              className="overflow-visible rounded-[20px] bg-white p-0 shadow-[0_12px_30px_-14px_rgba(20,25,60,0.18)]"
            >
              <div className="flex flex-col gap-0.5 px-5 pt-5 pb-4">
                <p className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                  {service?.name}
                </p>
                {invoice && <p className="text-[12.5px] font-medium text-ink-soft">{invoice.objectLabel}</p>}
              </div>

              {invoiceFailed && (
                <p className="px-5 pb-4 text-sm text-red-600">Échec du chargement des détails.</p>
              )}
              {!invoiceFailed && showInvoiceLoading && (
                <p className="px-5 pb-4 text-sm text-ink-soft">Chargement…</p>
              )}

              {/* Séparateur "ticket déchiré" : deux encoches en négatif sur les bords + trait pointillé */}
              <div className="relative h-0">
                <div className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-white" />
                <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white" />
                <div className="mx-6 border-t-2 border-dashed border-hairline" />
              </div>

              <div className="flex items-center gap-4 px-5 py-5">
                <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-success-tint">
                  <Mail size={28} className="text-success" />
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
                    Total réglé
                  </p>
                  <p className="text-2xl font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {invoice ? euros(invoice.amountCents) : '—'}
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col items-center gap-3">
              <Link to={`/factures/${slug}`} className="text-[13px] font-semibold text-ink-soft">
                Retour à l'accueil
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            {status === 'expired' ? (
              <AlertTriangle size={32} className="text-amber-500" />
            ) : (
              <XCircle size={32} className="text-red-600" />
            )}
            <p className="font-semibold text-ink">{STATUS_LABELS[status]}</p>
            <p className="text-sm text-ink-soft">Aucune somme n'a été prélevée. Vous pouvez réessayer le paiement.</p>
            {retryError && <p className="text-sm text-red-600">{retryError}</p>}
            <PublicGhostButton type="button" onClick={handleRetry} disabled={retrying} className="w-full">
              {retrying ? 'Redirection…' : 'Réessayer le paiement'}
            </PublicGhostButton>
          </div>
        )}
      </div>
    </PublicShell>
  )
}

export default InvoiceReturnPage
