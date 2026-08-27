import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Formation } from '@/lib/types'
import { euros, formatDateLabel } from '@/lib/format'
import { apiCall } from '@/lib/api'
import { PublicButton, PublicGhostButton } from './PublicButtons'

const WAITLIST_STEPS = [
  'Une place se libère et c\'est votre tour : vous recevez un email.',
  'Vous avez 48 heures pour confirmer votre place.',
  'Sans réponse, la place passe à la personne suivante.',
]

// Formation complète : le rang est le chiffre héros — la seule chose que
// le citoyen revient vérifier. Marine, pas corail : rien ne lui est
// demandé (voir maquette écran E1).
export function RegistrationWaitlist({
  formation,
  rank,
  accessToken,
  orgId,
  slug,
  canConfirm,
  onLeft,
  onConfirmed,
}: {
  formation: Pick<Formation, 'title' | 'eventDate' | 'timeLabel' | 'priceCents'>
  rank: number
  accessToken: string
  orgId: number
  slug?: string
  canConfirm?: boolean
  onLeft?: () => void
  onConfirmed?: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function handleLeave() {
    setLeaving(true)
    setLeaveError(null)
    const result = await apiCall(
      'POST',
      `/inscription/registrations/by-token/${accessToken}/cancel?orgId=${orgId}`,
      { body: {} },
    )
    setLeaving(false)
    if (result.ok) onLeft?.()
    else setLeaveError('Échec — réessayez.')
  }

  async function handleConfirm() {
    setConfirming(true)
    setConfirmError(null)
    const result = await apiCall<{ data: { status: string; paymentUrl?: string } }>(
      'POST',
      `/inscription/registrations/by-token/${accessToken}/pay?orgId=${orgId}`,
      { body: { frontRedirectUrl: `${window.location.origin}/inscription/${slug}/retour` } },
    )
    if (result.ok) {
      if (result.data.data.paymentUrl) {
        window.location.href = result.data.data.paymentUrl
        return
      }
      onConfirmed?.()
      return
    }
    setConfirming(false)
    setConfirmError('Échec — réessayez.')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col items-center gap-5 pt-8 text-center md:mx-auto md:max-w-md"
    >
      <div
        className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-[oklch(0.95_0.02_265)] text-[30px] font-bold text-aregie-deep"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {rank}
      </div>
      <div>
        <p className="text-[23px] leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          Vous êtes {rank}
          <sup className="text-[0.6em] font-bold">e</sup> sur la liste d'attente
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">
          {formation.title} est complet. Votre demande est enregistrée — rien de plus à faire pour l'instant.
        </p>
      </div>

      <div className="squircle flex w-full flex-col gap-[13px] rounded-[18px] bg-date-tint px-[18px] py-[17px] text-left">
        <p className="text-[12.5px] font-bold tracking-[0.03em] text-[oklch(0.35_0.02_260)]">CE QUI SE PASSERA</p>
        {WAITLIST_STEPS.map((text, i) => (
          <div key={text} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aregie-deep text-[11.5px] font-bold text-white">
              {i + 1}
            </span>
            <span className="flex-1 text-[12.5px] leading-[1.55] text-[oklch(0.42_0.015_260)]">{text}</span>
          </div>
        ))}
      </div>

      <div className="squircle w-full rounded-[18px] border-[1.5px] border-hairline px-[17px] py-[15px] text-left">
        <p className="text-[14.5px] leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {formation.title}
        </p>
        <p className="pt-1 text-[12.5px] leading-[1.4] font-medium text-ink-soft">
          {[formation.eventDate ? formatDateLabel(formation.eventDate) : null, formation.timeLabel]
            .filter(Boolean)
            .join(' · ')}
          {' · '}
          {formation.priceCents === 0 ? 'Gratuit' : euros(formation.priceCents)}
        </p>
        <p className="pt-2 text-[12px] leading-[1.4] font-medium text-ink-soft">
          Vous ne payez qu'après confirmation de votre place.
        </p>
      </div>

      {canConfirm && (
        <div className="squircle flex w-full flex-col gap-2 rounded-[18px] border-2 border-aregie-coral bg-[oklch(0.98_0.012_35)] px-[17px] py-[15px] text-left">
          <p className="text-[13.5px] leading-[1.4] font-bold text-[oklch(0.42_0.14_35)]">
            Une place s'est libérée — c'est votre tour !
          </p>
          <PublicButton type="button" onClick={handleConfirm} disabled={confirming} className="w-full">
            {confirming ? 'Confirmation…' : 'Confirmer ma place →'}
          </PublicButton>
          {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
        </div>
      )}

      <PublicGhostButton type="button" onClick={handleLeave} disabled={leaving} className="w-full">
        {leaving ? 'Départ…' : "Quitter la liste d'attente"}
      </PublicGhostButton>
      {leaveError && <p className="text-sm text-red-600">{leaveError}</p>}
    </motion.div>
  )
}
