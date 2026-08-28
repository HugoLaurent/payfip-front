import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicShell } from '@/layouts/PublicShell'
import { euros, formatDateLabel } from '@/lib/format'
import { apiCall, apiUploadWithFields } from '@/lib/api'
import { useEmailOtpVerification } from '@/lib/useEmailOtpVerification'
import type { Formation, ServiceLookup } from '@/lib/types'
import {
  EmailVerificationStep,
  FileUploadField,
  INSCRIPTION_STEPS,
  PublicButton,
  PublicServiceHeader,
  RegistrantIdentityFields,
  RegistrationFieldInput,
  ServiceQuestionsDivider,
  StepIndicator,
  isFieldFilled,
  type FieldValue,
} from '@/components/public'

type Step = 'fiche' | 'email' | 'form'

interface CreateRegistrationResponse {
  data: { registrationId: number; status: string; accessToken: string; paymentUrl?: string; waitlistPosition?: number }
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Écrans A2 → A3 → A4 → (redirection) — entrée par le catalogue (1a). La
// fiche annonce le circuit complet (justificatif → vérification 48 h →
// email de paiement) avant que le citoyen commence, voir maquette
// "Parcours Inscription". L'issue réelle (confirmé / liste d'attente / en
// attente de révision / paiement) est décidée par le back — voir
// InscriptionReturnPage, vers laquelle on navigue après l'envoi.
export function PublicInscriptionFormationPage() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>()
  const navigate = useNavigate()

  const [service, setService] = useState<ServiceLookup | null>(null)
  const [serviceError, setServiceError] = useState(false)
  const [event, setEvent] = useState<Formation | null>(null)
  const [eventError, setEventError] = useState(false)

  const [step, setStep] = useState<Step>('fiche')
  const [logoFailed, setLogoFailed] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const otp = useEmailOtpVerification({
    orgId: service?.orgId ?? null,
    requestPath: '/inscription/otp/request',
    verifyPath: '/inscription/otp/verify',
  })
  const { email } = otp

  useEffect(() => {
    if (!slug) return
    apiCall<{ data: ServiceLookup }>('GET', `/inscription/services/lookup/${slug}`).then((result) => {
      if (result.ok) setService(result.data.data)
      else setServiceError(true)
    })
  }, [slug])

  useEffect(() => {
    if (!service || !eventSlug) return
    apiCall<{ data: Formation }>(
      'GET',
      `/inscription/events/by-slug/${eventSlug}?orgId=${service.orgId}&serviceId=${service.serviceId}`,
    ).then((result) => {
      if (result.ok) setEvent(result.data.data)
      else setEventError(true)
    })
  }, [service, eventSlug])

  const consentField = useMemo(
    () => ({ key: '__consent', label: "J'accepte le règlement intérieur de la formation.", type: 'checkbox' as const, required: true }),
    [],
  )
  const allFields = [...(event?.formSchema ?? []), consentField]
  const formValid =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    allFields.every((f) => isFieldFilled(f, values[f.key])) &&
    (!event?.requiresDocuments || documentFile !== null)

  async function handleSubmit() {
    if (!formValid || !event || !service || !slug) return
    setSubmitting(true)
    setSubmitError(null)

    const formResponses = Object.fromEntries(Object.entries(values).filter(([k]) => k !== '__consent'))
    const frontRedirectUrl = `${window.location.origin}/inscription/${slug}/retour`

    const result = event.requiresDocuments
      ? await apiUploadWithFields<CreateRegistrationResponse>(
          `/inscription/registrations/with-documents`,
          documentFile ? [documentFile] : [],
          {
            orgId: String(service.orgId),
            eventId: String(event.id),
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            quantity: String(quantity),
            formResponses: JSON.stringify(formResponses),
            frontRedirectUrl,
          },
        )
      : await apiCall<CreateRegistrationResponse>('POST', '/inscription/registrations', {
          body: {
            orgId: service.orgId,
            eventId: event.id,
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            quantity,
            formResponses,
            frontRedirectUrl,
          },
        })

    if (result.ok) {
      const d = result.data.data
      if ('paymentUrl' in d && d.paymentUrl) {
        window.location.href = d.paymentUrl
        return
      }
      navigate(
        `/inscription/${slug}/retour?accessToken=${d.accessToken}&status=${d.status}&orgId=${service.orgId}`,
      )
      return
    }

    setSubmitting(false)
    setSubmitError("Échec de l'envoi de l'inscription — réessayez.")
  }

  if (serviceError || eventError) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">
          Formation introuvable — vérifiez le lien qui vous a été communiqué.
        </p>
      </PublicShell>
    )
  }

  if (!service || !event) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">Chargement…</p>
      </PublicShell>
    )
  }

  const full = event.isFull

  if (step === 'email') {
    return (
      <EmailVerificationStep
        service={service}
        logoFailed={logoFailed}
        onLogoFail={() => setLogoFailed(true)}
        steps={INSCRIPTION_STEPS}
        coverUrl={null}
        introText="Nous vérifions votre adresse email avant de commencer. Toutes les nouvelles de votre inscription y seront envoyées."
        otp={otp}
        onBack={() => setStep('fiche')}
        onContinue={() => setStep('form')}
      />
    )
  }

  if (step === 'form') {
    const totalCents = event.priceCents * quantity
    const dateLine = [event.eventDate ? formatDateLabel(event.eventDate) : null, event.timeLabel].filter(Boolean).join(' · ')
    const ctaLabel = submitting ? 'Envoi…' : full ? "Rejoindre la liste d'attente →" : 'Envoyer mon inscription →'

    return (
      <motion.div key="form" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
        <PublicShell
          header={
            <div className="md:mx-auto md:w-full md:max-w-[1008px]">
              <PublicServiceHeader
                service={service}
                logoFailed={logoFailed}
                onLogoFail={() => setLogoFailed(true)}
                onBack={() => setStep('email')}
              />
              <div className="px-0 pt-[2px] pb-4">
                <StepIndicator steps={INSCRIPTION_STEPS} current="inscription" />
              </div>
            </div>
          }
          footer={
            <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
              <PublicButton type="button" onClick={handleSubmit} disabled={!formValid || submitting} className="w-full">
                {ctaLabel}
              </PublicButton>
              {submitError && <p className="mt-2 text-center text-sm text-red-600">{submitError}</p>}
            </div>
          }
        >
          {/* Desktop (maquette écran D2) : colonne de contenu à largeur de
            lecture (640px) + récap collant à droite qui porte le CTA — le
            bouton fixe en bas (footer, masqué ici via md:hidden) ne sert
            qu'en mobile. */}
          <div className="md:mx-auto md:flex md:w-full md:max-w-[1008px] md:items-start md:gap-7">
            <div className="flex flex-col gap-4 md:w-[640px] md:flex-none md:squircle md:rounded-[22px] md:border-[1.5px] md:border-hairline md:p-[30px]">
              <RegistrantIdentityFields
                firstName={firstName}
                lastName={lastName}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                quantity={quantity}
                maxQuantity={event.maxParticipantsPerRegistration}
                onQuantityChange={setQuantity}
              />
              {(event.formSchema ?? []).length > 0 && <ServiceQuestionsDivider />}
              {(event.formSchema ?? []).map((field) => (
                <RegistrationFieldInput
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}
              {event.requiresDocuments && <FileUploadField onFileChange={setDocumentFile} />}
              <RegistrationFieldInput
                field={consentField}
                value={values[consentField.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [consentField.key]: v }))}
              />
            </div>

            <div className="hidden md:sticky md:top-5 md:flex md:w-[340px] md:flex-none md:flex-col md:gap-[14px]">
              <div className="squircle overflow-hidden rounded-[22px] border-[1.5px] border-hairline bg-white">
                <div className="px-6 pt-[22px] pb-5">
                  <p className="text-[11px] leading-none font-bold tracking-[0.06em] text-ink-soft uppercase">
                    Vous vous inscrivez à
                  </p>
                  <p className="pt-[10px] text-[18px] leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {event.title}
                  </p>
                  {(dateLine || event.location) && (
                    <p className="pt-2 text-[13px] leading-[1.55] font-medium text-ink-soft">
                      {dateLine}
                      {event.location && (
                        <>
                          {dateLine && <br />}
                          {event.location}
                        </>
                      )}
                    </p>
                  )}
                </div>
                {full ? (
                  <>
                    <div className="h-px bg-hairline" />
                    <div className="px-6 py-[14px] text-[13px] font-bold text-[oklch(0.42_0.015_260)]">
                      Formation complète — inscription en liste d'attente
                    </div>
                  </>
                ) : event.seatsRemaining !== null ? (
                  <>
                    <div className="h-px bg-hairline" />
                    <div className="flex items-center gap-[11px] px-6 py-[16px]">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-[13px] font-bold text-white">
                        {event.seatsRemaining}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-[1.3] font-bold text-[oklch(0.32_0.07_150)]">
                          Il reste {event.seatsRemaining} place{event.seatsRemaining > 1 ? 's' : ''}
                          {event.capacity !== null ? ` sur ${event.capacity}` : ''}
                        </p>
                        {event.registrationDeadline && (
                          <p className="text-[11.5px] leading-[1.35] font-medium text-[oklch(0.45_0.06_150)]">
                            Inscriptions closes le {new Date(event.registrationDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
                <div className="h-px bg-hairline" />
                <div className="flex items-center justify-between bg-date-tint px-6 py-[18px]">
                  <span className="text-[13px] leading-none font-semibold text-[oklch(0.42_0.015_260)]">
                    {event.requiresDocuments ? 'Montant après validation' : 'À régler'}
                  </span>
                  <span className="text-[22px] leading-none font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {totalCents === 0 ? 'Gratuit' : euros(totalCents)}
                  </span>
                </div>
                <div className="flex flex-col gap-[10px] px-6 pt-[18px] pb-[22px]">
                  <PublicButton type="button" onClick={handleSubmit} disabled={!formValid || submitting} className="w-full">
                    {ctaLabel}
                  </PublicButton>
                  {event.requiresDocuments && (
                    <p className="text-center text-[11.5px] leading-[1.5] font-medium text-ink-soft">
                      Vous ne payez pas maintenant : le paiement vient après validation du justificatif.
                    </p>
                  )}
                  {submitError && <p className="text-center text-sm text-red-600">{submitError}</p>}
                </div>
              </div>

              {event.requiresDocuments && (
                <div className="squircle rounded-[18px] bg-[oklch(0.96_0.02_265)] p-4">
                  <p className="text-[11.5px] leading-none font-bold tracking-[0.03em] text-[oklch(0.35_0.09_265)]">
                    APRÈS L'ENVOI
                  </p>
                  <p className="pt-2 text-[12.5px] leading-[1.6] text-[oklch(0.42_0.05_265)]">
                    Un agent vérifie votre justificatif sous 48 h ouvrées, puis vous recevez un email pour payer et
                    confirmer votre place.
                  </p>
                </div>
              )}
            </div>
          </div>
        </PublicShell>
      </motion.div>
    )
  }

  // step === 'fiche'
  return (
    <motion.div key="fiche" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <PublicShell
        header={
          <div className="md:mx-auto md:w-full md:max-w-md">
            <PublicServiceHeader
              service={service}
              logoFailed={logoFailed}
              onLogoFail={() => setLogoFailed(true)}
              onBack={() => navigate(`/inscription/${slug}`)}
            />
          </div>
        }
        footer={
          <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
            <PublicButton type="button" onClick={() => setStep('email')} className="w-full">
              {full ? "Rejoindre la liste d'attente →" : "S'inscrire →"}
            </PublicButton>
          </div>
        }
      >
        <div className="flex flex-col gap-[18px] md:mx-auto md:max-w-md">
          <div>
            <p className="text-2xl leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {event.title}
            </p>
            {event.description && <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">{event.description}</p>}
          </div>

          <div className="squircle flex flex-col overflow-hidden rounded-[16px] border-[1.5px] border-hairline">
            {(event.eventDate || event.timeLabel) && (
              <>
                <div className="flex items-center justify-between gap-3 bg-white px-4 py-[13px]">
                  <span className="text-[12.5px] font-medium text-ink-soft">Date</span>
                  <span className="text-right text-[13.5px] font-bold text-ink">
                    {[event.eventDate ? formatDateLabel(event.eventDate) : null, event.timeLabel].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="h-px bg-hairline" />
              </>
            )}
            {event.location && (
              <>
                <div className="flex items-center justify-between gap-3 bg-white px-4 py-[13px]">
                  <span className="text-[12.5px] font-medium text-ink-soft">Lieu</span>
                  <span className="text-right text-[13.5px] font-bold text-ink">{event.location}</span>
                </div>
                <div className="h-px bg-hairline" />
              </>
            )}
            <div className="flex items-center justify-between gap-3 bg-white px-4 py-[13px]">
              <span className="text-[12.5px] font-medium text-ink-soft">Tarif</span>
              <span className="text-[15px] font-bold text-aregie-deep" style={{ fontFamily: 'var(--font-display)' }}>
                {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
              </span>
            </div>
          </div>

          {full ? (
            <div className="squircle flex items-center gap-[10px] rounded-[16px] border-[1.5px] border-hairline bg-[oklch(0.985_0.004_260)] px-4 py-[13px]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.008_260)] text-[13px] font-bold text-[oklch(0.45_0.015_260)]">
                !
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-[1.3] font-bold text-[oklch(0.42_0.015_260)]">
                  Formation complète — inscription en liste d'attente
                </p>
              </div>
            </div>
          ) : event.seatsRemaining !== null ? (
            <div className="squircle flex items-center gap-[10px] rounded-[16px] border-[1.5px] border-success-border bg-success-tint px-4 py-[13px]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-[15px] font-bold text-white">
                {event.seatsRemaining}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-[1.3] font-bold text-[oklch(0.32_0.07_150)]">
                  Il reste {event.seatsRemaining} place{event.seatsRemaining > 1 ? 's' : ''}
                  {event.capacity !== null ? ` sur ${event.capacity}` : ''}
                </p>
                {event.registrationDeadline && (
                  <p className="text-[11.5px] leading-[1.35] font-medium text-[oklch(0.45_0.06_150)]">
                    Inscriptions closes le {formatDeadline(event.registrationDeadline)}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {event.requiresDocuments && (
            <div className="squircle rounded-[16px] bg-[oklch(0.96_0.02_265)] px-4 py-[14px]">
              <p className="text-[12.5px] leading-none font-bold tracking-[0.02em] text-[oklch(0.35_0.09_265)]">
                JUSTIFICATIF DEMANDÉ
              </p>
              <p className="pt-[7px] text-[12.5px] leading-[1.6] text-[oklch(0.42_0.05_265)]">
                {event.documentInstructions ??
                  "Vous le déposerez à l'étape suivante ; un agent le vérifie sous 48 h, puis vous recevrez un email pour payer."}
              </p>
            </div>
          )}

          <div className="hidden md:block">
            <PublicButton type="button" onClick={() => setStep('email')} className="w-full">
              {full ? "Rejoindre la liste d'attente →" : "S'inscrire →"}
            </PublicButton>
          </div>
        </div>
      </PublicShell>
    </motion.div>
  )
}

export default PublicInscriptionFormationPage
