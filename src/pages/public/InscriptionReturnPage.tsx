import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiCall } from '@/lib/api'
import { usePaymentStatusPolling, isPendingPaymentStatus } from '@/lib/usePaymentStatusPolling'
import { euros } from '@/lib/format'
import type { RegistrationCitizen } from '@/lib/types'
import { PublicShell } from '@/layouts/PublicShell'
import {
  PaymentFailedState,
  PaymentPendingState,
  PublicButton,
  RegistrationConfirmation,
  RegistrationRejected,
  RegistrationWaitlist,
} from '@/components/public'

type PaymentStatus = 'draft' | 'awaiting_payment' | 'paid' | 'confirmed' | 'failed' | 'cancelled' | 'expired'

// by-token ne renvoie pas accessToken (déjà connu de l'appelant) ;
// by-reference si — type unifié pour éviter une union de deux formes
// différentes entre les deux branches d'appel ci-dessous.
interface RegistrationLookupResponse {
  data: RegistrationCitizen & { accessToken?: string }
}

// Page de retour unique pour toutes les issues d'une inscription (voir
// PublicInscriptionFormationPage/DirectPage) : confirmée, liste d'attente,
// justificatif en cours de révision, ou retour du paiement PayFiP.
// Deux modes d'arrivée :
//  - instant (gratuit / liste d'attente / justificatif) : navigate()
//    client-side avec ?accessToken=&status=&orgId= — le statut est déjà
//    définitif, pas de polling.
//  - retour PayFiP réel : svc-gestion redirige avec ?idop=&status=&orgId=
//    &sourceReference= (jamais l'accessToken, inconnu à la création de la
//    session de paiement) — voir showByReference côté svc-inscription.
export function InscriptionReturnPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const accessTokenParam = searchParams.get('accessToken')
  const idop = searchParams.get('idop')
  const orgId = searchParams.get('orgId')
  const sourceReference = searchParams.get('sourceReference')
  const initialStatus = (searchParams.get('status') as PaymentStatus | null) ?? null

  const isInstant = Boolean(accessTokenParam)
  const missingParams = isInstant ? !accessTokenParam || !orgId : !idop || !orgId || !sourceReference || !initialStatus

  const { status, maxAttemptsReached } = usePaymentStatusPolling<PaymentStatus>({
    idop,
    // Le mode instantané ne passe jamais par le polling PayFiP — le
    // statut fourni est déjà définitif.
    missingParams: missingParams || isInstant,
    initialStatus: isInstant ? (initialStatus ?? 'confirmed') : initialStatus,
  })

  const [registration, setRegistration] = useState<RegistrationCitizen | null>(null)
  const [registrationFailed, setRegistrationFailed] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(accessTokenParam)

  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [payingNow, setPayingNow] = useState(false)
  const [payNowError, setPayNowError] = useState<string | null>(null)

  async function handlePayNow() {
    if (!accessToken || !orgId || !slug) return
    setPayingNow(true)
    setPayNowError(null)
    const result = await apiCall<{ data: { paymentUrl?: string } }>(
      'POST',
      `/inscription/registrations/by-token/${accessToken}/pay?orgId=${orgId}`,
      { body: { frontRedirectUrl: `${window.location.origin}/inscription/${slug}/retour` } },
    )
    if (result.ok && result.data.data.paymentUrl) {
      window.location.href = result.data.data.paymentUrl
      return
    }
    setPayingNow(false)
    setPayNowError('Échec — réessayez.')
  }

  useEffect(() => {
    if (missingParams) return
    if (!isInstant && status !== 'paid' && status !== 'confirmed') return

    setRegistration(null)
    setRegistrationFailed(false)

    const request = isInstant
      ? apiCall<RegistrationLookupResponse>('GET', `/inscription/registrations/by-token/${accessTokenParam}?orgId=${orgId}`)
      : apiCall<RegistrationLookupResponse>(
          'GET',
          `/inscription/registrations/by-reference/${sourceReference}?orgId=${orgId}&idop=${idop}`,
        )

    request.then((result) => {
      if (result.ok) {
        setRegistration(result.data.data)
        if (result.data.data.accessToken) setAccessToken(result.data.data.accessToken)
      } else {
        setRegistrationFailed(true)
      }
    })
  }, [status, missingParams, isInstant, accessTokenParam, sourceReference, orgId, idop, refreshKey])

  async function handleRetryPayment() {
    if (!accessToken || !orgId || !slug) return
    setRetrying(true)
    setRetryError(null)
    const result = await apiCall<{ data: { paymentUrl: string } }>(
      'POST',
      `/inscription/registrations/by-token/${accessToken}/retry-payment?orgId=${orgId}`,
      { body: { frontRedirectUrl: `${window.location.origin}/inscription/${slug}/retour` } },
    )
    if (result.ok) {
      window.location.href = result.data.data.paymentUrl
      return
    }
    setRetrying(false)
    setRetryError('Échec de la nouvelle tentative de paiement.')
  }

  if (missingParams) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">Lien de retour invalide ou incomplet.</p>
      </PublicShell>
    )
  }

  // Retour PayFiP réel, encore en cours de résolution — jamais pour le
  // mode instantané, déjà définitif.
  if (!isInstant && status && isPendingPaymentStatus(status)) {
    const labels: Record<string, string> = {
      draft: 'Paiement en préparation…',
      awaiting_payment: 'Vérification du paiement…',
    }
    return (
      <PublicShell>
        <div className="mx-auto max-w-md pt-4">
          <PaymentPendingState label={labels[status] ?? 'Vérification…'} maxAttemptsReached={maxAttemptsReached} />
        </div>
      </PublicShell>
    )
  }

  if (!isInstant && status !== 'paid' && status !== 'confirmed') {
    return (
      <PublicShell>
        <div className="mx-auto max-w-md pt-4">
          <PaymentFailedState
            expired={status === 'expired'}
            label={status === 'expired' ? 'Le délai de paiement a expiré' : 'Le paiement a échoué'}
            retryError={retryError}
            retrying={retrying}
            onRetry={handleRetryPayment}
          />
        </div>
      </PublicShell>
    )
  }

  if (registrationFailed) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">Inscription introuvable.</p>
      </PublicShell>
    )
  }

  if (!registration) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">Chargement…</p>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-md pt-4">
        {registration.status === 'confirmed' && accessToken && orgId && (
          <RegistrationConfirmation
            formation={{
              title: registration.eventTitle,
              eventDate: registration.eventDate,
              startTime: null,
              endTime: null,
              timeLabel: null,
              location: null,
            }}
            participantName={`${registration.firstName} ${registration.lastName}`.trim()}
            registrationCode={registration.registrationReference}
            email={registration.email}
            amountCents={registration.amountCents}
            accessToken={accessToken}
            orgId={Number(orgId)}
          />
        )}

        {registration.status === 'waitlisted' && accessToken && orgId && (
          <RegistrationWaitlist
            formation={{ title: registration.eventTitle, eventDate: registration.eventDate, timeLabel: null, priceCents: registration.amountCents }}
            rank={registration.waitlistPosition ?? 1}
            accessToken={accessToken}
            orgId={Number(orgId)}
            slug={slug}
            canConfirm={registration.canConfirmWaitlistOffer}
            onLeft={() => setRefreshKey((k) => k + 1)}
            onConfirmed={() => setRefreshKey((k) => k + 1)}
          />
        )}

        {registration.status === 'awaiting_review' && (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <div className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-[oklch(0.95_0.02_265)] text-[30px]">
              📄
            </div>
            <p className="text-xl font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Votre justificatif est en cours de vérification
            </p>
            <p className="max-w-sm text-sm text-ink-soft">
              Un agent le contrôle sous 48 h ouvrées. Vous n'avez rien à faire — nous vous écrivons dès que c'est
              validé.
            </p>
          </div>
        )}

        {registration.status === 'rejected' && accessToken && orgId && (
          <RegistrationRejected
            rejectionReason={registration.rejectionReason}
            reviewedByLabel={registration.reviewedByLabel}
            reviewedAt={registration.reviewedAt}
            documentDeadlineAt={registration.documentDeadlineAt}
            accessToken={accessToken}
            orgId={Number(orgId)}
            onReplaced={() => setRefreshKey((k) => k + 1)}
          />
        )}

        {registration.status === 'awaiting_payment' && accessToken && orgId && (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <p className="font-semibold text-ink">Votre dossier est accepté — il reste à payer</p>
            <p className="max-w-sm text-sm text-ink-soft">
              Réglez la formation pour que votre place soit définitive : {euros(registration.amountCents)}.
            </p>
            <PublicButton type="button" onClick={handlePayNow} disabled={payingNow} className="w-full max-w-xs">
              {payingNow ? 'Redirection…' : 'Payer maintenant →'}
            </PublicButton>
            {payNowError && <p className="text-sm text-red-600">{payNowError}</p>}
          </div>
        )}

        {(registration.status === 'cancelled' || registration.status === 'expired') && (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <p className="font-semibold text-ink">
              {registration.status === 'expired' ? 'Le délai de paiement est passé' : 'Inscription annulée'}
            </p>
            <p className="max-w-sm text-sm text-ink-soft">
              {registration.status === 'expired'
                ? `Votre inscription à « ${registration.eventTitle} » a expiré faute de paiement. La place a été rendue disponible.`
                : `Votre inscription à « ${registration.eventTitle} » a été annulée. Aucune somme n'a été prélevée.`}
            </p>
          </div>
        )}
      </div>
    </PublicShell>
  )
}

export default InscriptionReturnPage
