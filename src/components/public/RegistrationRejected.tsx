import { useState } from 'react'
import { motion } from 'framer-motion'
import { apiUploadWithFields } from '@/lib/api'
import { FileUploadField } from './FileUploadField'
import { PublicButton } from './PublicButtons'

function formatSignatureDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) +
    ', ' +
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Écran E3 — justificatif refusé : le motif de l'agent est cité mot pour
// mot, daté et signé du service (jamais reformulé), la place reste
// réservée jusqu'à une échéance, et le citoyen peut redéposer un document
// sans repasser par tout le formulaire (voir maquette "Parcours
// Inscription"). Desktop : même gabarit que les autres écrans d'état —
// motif à gauche, dépôt du nouveau document à droite.
export function RegistrationRejected({
  rejectionReason,
  reviewedByLabel,
  reviewedAt,
  documentDeadlineAt,
  accessToken,
  orgId,
  onReplaced,
}: {
  rejectionReason: string | null
  reviewedByLabel: string | null
  reviewedAt: string | null
  documentDeadlineAt: string | null
  accessToken: string
  orgId: number
  onReplaced: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!file) return
    setSubmitting(true)
    setError(null)
    const result = await apiUploadWithFields(
      `/inscription/registrations/by-token/${accessToken}/documents`,
      [file],
      { orgId: String(orgId) },
    )
    setSubmitting(false)
    if (result.ok) onReplaced()
    else setError('Échec de l\'envoi — réessayez.')
  }

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
            Votre justificatif n'a pas pu être accepté
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">
            {documentDeadlineAt
              ? `Votre place reste réservée jusqu'au ${formatDeadline(documentDeadlineAt)}. Déposez un nouveau document et la vérification repart.`
              : 'Déposez un nouveau document et la vérification repart.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[13px] md:grid md:grid-cols-[1fr_320px] md:items-start">
        {rejectionReason ? (
          <div className="squircle w-full rounded-[16px] bg-[oklch(0.96_0.02_265)] px-4 py-[14px] text-left md:rounded-[22px] md:px-6 md:py-5">
            <p className="text-[12.5px] leading-none font-bold tracking-[0.02em] text-[oklch(0.35_0.09_265)]">
              MOTIF INDIQUÉ PAR L'AGENT
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

        <div className="squircle flex flex-col gap-[10px] rounded-[18px] border-[1.5px] border-hairline p-4 text-left md:rounded-[22px] md:p-5">
          <FileUploadField label="Déposer un nouveau justificatif" onFileChange={setFile} />
          <PublicButton type="button" onClick={handleSubmit} disabled={!file || submitting} className="w-full">
            {submitting ? 'Envoi…' : 'Envoyer le nouveau document'}
          </PublicButton>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </motion.div>
  )
}
