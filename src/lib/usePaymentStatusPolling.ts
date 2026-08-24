import { useEffect, useState } from 'react'
import { apiCall } from './api'

const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 6

export function isPendingPaymentStatus(status: string): boolean {
  return status === 'draft' || status === 'awaiting_payment'
}

// Filet de sécurité : le callback du gateway résout normalement le
// paiement avant de rediriger sur la page de retour — ce polling ne sert
// que si le statut arrive encore en transition (draft/awaiting_payment).
export function usePaymentStatusPolling<Status extends string>({
  idop,
  missingParams,
  initialStatus,
}: {
  idop: string | null
  missingParams: boolean
  initialStatus: Status | null
}) {
  const [status, setStatus] = useState<Status | null>(initialStatus)
  const [pollAttempts, setPollAttempts] = useState(0)

  useEffect(() => {
    if (missingParams || !status || !isPendingPaymentStatus(status) || pollAttempts >= POLL_MAX_ATTEMPTS) {
      return
    }

    const timeout = setTimeout(async () => {
      const result = await apiCall<{ data: { status: Status } }>('GET', `/paiement/status/${idop}`)
      if (result.ok) setStatus(result.data.data.status)
      setPollAttempts((n) => n + 1)
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timeout)
  }, [status, pollAttempts, missingParams, idop])

  return { status, maxAttemptsReached: pollAttempts >= POLL_MAX_ATTEMPTS }
}
