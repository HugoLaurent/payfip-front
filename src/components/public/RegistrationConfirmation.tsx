import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Formation } from '@/lib/types'
import { euros, formatDateLabel } from '@/lib/format'
import { GATEWAY_URL } from '@/lib/api'
import { downloadEventIcs } from '@/lib/ics'
import { PublicButton, PublicGhostButton } from './PublicButtons'

// Écran de fin — gratuit ou payant partagent le même écran, seule la
// ligne "Montant payé" change (voir maquette écran A5). Pas de billet PDF
// ici : une attestation d'inscription, document différent du billet.
export function RegistrationConfirmation({
  formation,
  participantName,
  registrationCode,
  email,
  amountCents,
  accessToken,
  orgId,
}: {
  formation: Pick<Formation, 'title' | 'eventDate' | 'startTime' | 'endTime' | 'timeLabel' | 'location'>
  participantName: string
  registrationCode: string
  email: string
  amountCents: number
  accessToken: string
  orgId: number
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  function handleAddToCalendar() {
    if (!formation.eventDate) return
    downloadEventIcs({
      title: formation.title,
      location: formation.location,
      eventDate: formation.eventDate,
      startTime: formation.startTime,
      endTime: formation.endTime,
    })
  }

  async function handleDownloadAttestation() {
    setDownloadError(false)
    setDownloading(true)
    const res = await fetch(
      `${GATEWAY_URL}/inscription/registrations/by-token/${accessToken}/attestation?orgId=${orgId}`,
    )
    setDownloading(false)
    if (!res.ok) {
      setDownloadError(true)
      return
    }
    const blob = await res.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  const dateLine = [
    formation.eventDate ? formatDateLabel(formation.eventDate) : null,
    formation.timeLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col items-center gap-[22px] pt-8 text-center md:mx-auto md:max-w-md"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
        className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-success-tint text-[38px] font-bold text-success"
      >
        ✓
      </motion.div>
      <div>
        <p className="text-2xl leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          Inscription confirmée
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">
          Votre place est réservée. Une confirmation part à l'instant sur {email}.
        </p>
      </div>

      <div className="squircle w-full overflow-hidden rounded-[18px] border-[1.5px] border-hairline text-left">
        <div className="bg-[oklch(0.985_0.004_260)] px-[17px] py-[15px]">
          <p className="text-[15.5px] leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            {formation.title}
          </p>
          {dateLine && (
            <p className="pt-1 text-[12.5px] leading-[1.4] font-medium text-ink-soft">
              {dateLine}
              {formation.location && (
                <>
                  <br />
                  {formation.location}
                </>
              )}
            </p>
          )}
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex items-center justify-between px-[17px] py-[14px]">
          <span className="text-[12.5px] font-medium text-ink-soft">Participant</span>
          <span className="text-[13.5px] font-bold text-ink">{participantName}</span>
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex items-center justify-between px-[17px] py-[14px]">
          <span className="text-[12.5px] font-medium text-ink-soft">N° d'inscription</span>
          <span className="font-mono text-[13.5px] font-bold text-ink">{registrationCode}</span>
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex items-center justify-between bg-date-tint px-[17px] py-[15px]">
          <span className="text-[12.5px] font-semibold text-[oklch(0.42_0.015_260)]">Montant payé</span>
          <span className="text-[19px] font-bold text-aregie-deep" style={{ fontFamily: 'var(--font-display)' }}>
            {amountCents === 0 ? 'Gratuit' : euros(amountCents)}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-[9px]">
        {formation.eventDate && (
          <PublicButton type="button" onClick={handleAddToCalendar} className="w-full">
            Ajouter à mon agenda
          </PublicButton>
        )}
        <PublicGhostButton type="button" onClick={handleDownloadAttestation} disabled={downloading} className="w-full">
          {downloading ? 'Préparation…' : "Télécharger l'attestation"}
        </PublicGhostButton>
        {downloadError && <p className="text-sm text-red-600">Échec du téléchargement — réessayez.</p>}
      </div>
    </motion.div>
  )
}
