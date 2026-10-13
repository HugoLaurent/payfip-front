import { motion } from 'framer-motion'
import type { DocumentRequirement } from '@/lib/types'
import { DocumentsByEmailCard } from './DocumentsByEmailCard'

function formatSignatureDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) +
    ', ' +
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Écran E3 — pièces refusées ou complément demandé : le motif de l'agent est
// cité mot pour mot, daté et signé du service (jamais reformulé), la place
// reste réservée jusqu'à une échéance, et le citoyen renvoie ses pièces par
// email à l'organisme (aucun dépôt de fichier sur PayFiP — voir
// DocumentsByEmailCard). Desktop : même gabarit que les autres écrans d'état —
// motif à gauche, consignes d'envoi à droite.
export function RegistrationRejected({
  rejectionReason,
  reviewedByLabel,
  reviewedAt,
  documentDeadlineAt,
  keepExistingDocuments,
  documentRequirements,
  documentContactEmail,
  registrationReference,
}: {
  rejectionReason: string | null
  reviewedByLabel: string | null
  reviewedAt: string | null
  documentDeadlineAt: string | null
  keepExistingDocuments: boolean
  documentRequirements: DocumentRequirement[] | null
  documentContactEmail: string | null
  registrationReference: string
}) {
  const requirements = documentRequirements ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col gap-5 pt-8 md:mx-auto md:max-w-[760px]"
    >
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:gap-5 md:text-left">
        <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.03_35)] text-[30px] font-bold text-aregie-coral">
          !
        </div>
        <div className="md:pt-1">
          <p className="text-[21px] leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            {keepExistingDocuments ? 'Une pièce supplémentaire est nécessaire' : "Vos pièces n'ont pas pu être acceptées"}
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">
            {keepExistingDocuments
              ? documentDeadlineAt
                ? `Les pièces déjà envoyées restent valables. Votre place reste réservée jusqu'au ${formatDeadline(documentDeadlineAt)} — envoyez par email la pièce demandée et la vérification repart.`
                : 'Les pièces déjà envoyées restent valables — envoyez par email la pièce demandée et la vérification repart.'
              : documentDeadlineAt
                ? `Votre place reste réservée jusqu'au ${formatDeadline(documentDeadlineAt)}. Renvoyez vos pièces par email et la vérification repart.`
                : 'Renvoyez vos pièces par email et la vérification repart.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[13px] md:grid md:grid-cols-[1fr_320px] md:items-start">
        {rejectionReason ? (
          <div className="squircle w-full rounded-[16px] bg-[oklch(0.96_0.02_265)] px-4 py-[14px] text-left md:rounded-[22px] md:px-6 md:py-5">
            <p className="text-[12.5px] leading-none font-bold tracking-[0.02em] text-[oklch(0.35_0.09_265)]">
              {keepExistingDocuments ? "MESSAGE DE L'AGENT" : "MOTIF INDIQUÉ PAR L'AGENT"}
            </p>
            <p className="pt-[7px] text-[12.5px] leading-[1.6] text-[oklch(0.42_0.05_265)]">{rejectionReason}</p>
            {(reviewedByLabel || reviewedAt) && (
              <p className="pt-2 text-[11px] leading-[1.3] font-medium text-[oklch(0.55_0.03_265)]">
                {reviewedByLabel}
                {reviewedByLabel && reviewedAt ? ' · ' : ''}
                {reviewedAt && formatSignatureDate(reviewedAt)}
              </p>
            )}
          </div>
        ) : (
          <div />
        )}

        {documentContactEmail && requirements.length > 0 ? (
          <DocumentsByEmailCard
            requirements={requirements}
            contactEmail={documentContactEmail}
            registrationReference={registrationReference}
            heading={keepExistingDocuments ? 'PIÈCE À ENVOYER PAR EMAIL' : 'PIÈCES À RENVOYER PAR EMAIL'}
          />
        ) : null}
      </div>
    </motion.div>
  )
}
