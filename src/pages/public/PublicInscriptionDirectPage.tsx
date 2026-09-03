import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ShieldCheck } from 'lucide-react'
import { PublicShell } from '@/layouts/PublicShell'
import { TextInput } from '@/components/ui'
import { euros } from '@/lib/format'
import { apiCall, apiUploadWithFields } from '@/lib/api'
import { useEmailOtpVerification } from '@/lib/useEmailOtpVerification'
import type { Formation, ServiceLookup } from '@/lib/types'
import {
  FileUploadField,
  OtpDigitInput,
  PublicButton,
  RegistrantIdentityFields,
  RegistrationFieldInput,
  ServiceQuestionsDivider,
  isFieldFilled,
  type FieldValue,
} from '@/components/public'

type Step = 'email' | 'form'

interface CreateRegistrationResponse {
  data: { registrationId: number; status: string; accessToken: string; paymentUrl?: string; waitlistPosition?: number }
}

// Écrans B1 → B2 → (redirection) — entrée par lien direct (1b) : le
// citoyen connaît déjà la formation (affiche, QR, mail), la fiche
// fusionne avec l'étape email. Pas de stepper ici, voir maquette "Parcours
// Inscription". L'issue réelle est décidée par le back — voir
// InscriptionReturnPage.
export function PublicInscriptionDirectPage() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Préremplissage démo (widget bas-droit) — jamais deviné, seulement ce
  // que ?demoEmail=/demoFirstName=/demoLastName= porte explicitement.
  const demoEmail = searchParams.get('demoEmail') ?? undefined
  const demoFirstName = searchParams.get('demoFirstName') ?? ''
  const demoLastName = searchParams.get('demoLastName') ?? ''

  const [service, setService] = useState<ServiceLookup | null>(null)
  const [event, setEvent] = useState<Formation | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [step, setStep] = useState<Step>('email')
  const [firstName, setFirstName] = useState(demoFirstName)
  const [lastName, setLastName] = useState(demoLastName)
  const [quantity, setQuantity] = useState(1)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const otp = useEmailOtpVerification({
    orgId: service?.orgId ?? null,
    requestPath: '/inscription/otp/request',
    verifyPath: '/inscription/otp/verify',
    initialEmail: demoEmail,
  })
  const { email, onEmailChange, otpSent, otpRequesting, otpError, devCode, codeDigits, setCodeDigits, verifying, verifyError, emailVerified, resendCooldown, handleRequestOtp, handleVerifyOtp, otpLength } = otp

  useEffect(() => {
    if (!slug) return
    apiCall<{ data: ServiceLookup }>('GET', `/inscription/services/lookup/${slug}`).then((result) => {
      if (result.ok) setService(result.data.data)
      else setLoadError(true)
    })
  }, [slug])

  useEffect(() => {
    if (!service || !eventSlug) return
    apiCall<{ data: Formation }>(
      'GET',
      `/inscription/events/by-slug/${eventSlug}?orgId=${service.orgId}&serviceId=${service.serviceId}`,
    ).then((result) => {
      if (result.ok) setEvent(result.data.data)
      else setLoadError(true)
    })
  }, [service, eventSlug])

  const consentField = useMemo(
    () => ({ key: '__consent', label: "J'accepte le règlement intérieur de la formation.", type: 'checkbox' as const, required: true }),
    [],
  )
  const allFields = [...(event?.formSchema ?? []), consentField]
  const documentRequirements = event?.documentRequirements ?? []
  const formValid =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    allFields.every((f) => isFieldFilled(f, values[f.key])) &&
    documentRequirements.every((r) => !r.required || documentFiles[r.key])

  async function handleSubmit() {
    if (!formValid || !event || !service || !slug) return
    setSubmitting(true)
    setSubmitError(null)

    const formResponses = Object.fromEntries(Object.entries(values).filter(([k]) => k !== '__consent'))
    const frontRedirectUrl = `${window.location.origin}/inscription/${slug}/retour`

    const filesToSend = Object.fromEntries(
      Object.entries(documentFiles).filter((entry): entry is [string, File] => entry[1] !== null),
    )

    const result = documentRequirements.length > 0
      ? await apiUploadWithFields<CreateRegistrationResponse>(
          `/inscription/registrations/with-documents`,
          filesToSend,
          {
            orgId: String(service.orgId),
            serviceId: String(service.serviceId),
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
            serviceId: service.serviceId,
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
      if (d.paymentUrl) {
        window.location.href = d.paymentUrl
        return
      }
      navigate(`/inscription/${slug}/retour?accessToken=${d.accessToken}&status=${d.status}&orgId=${service.orgId}`)
      return
    }

    setSubmitting(false)
    setSubmitError("Échec de l'envoi de l'inscription — réessayez.")
  }

  if (loadError) {
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

  if (step === 'form') {
    const totalCents = event.priceCents * quantity
    const ctaLabel = submitting ? 'Envoi…' : 'Valider mon inscription →'

    return (
      <motion.div key="form" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
        <PublicShell
          footer={
            <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
              <PublicButton type="button" onClick={handleSubmit} disabled={!formValid || submitting} className="w-full">
                {ctaLabel}
              </PublicButton>
              {submitError && <p className="mt-2 text-center text-sm text-red-600">{submitError}</p>}
            </div>
          }
        >
          <div className="md:mx-auto md:flex md:w-full md:max-w-[1008px] md:items-start md:gap-7">
            <div className="flex flex-col gap-4 md:w-[640px] md:flex-none md:squircle md:rounded-[22px] md:border-[1.5px] md:border-hairline md:p-[30px]">
              <div className="flex items-center gap-[11px] border-b border-[oklch(0.94_0.006_260)] pt-[14px] pb-3 md:border-none md:pt-0">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-success-tint text-[14px] font-bold text-success">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] leading-[1.25] font-bold text-ink">{email.trim()}</p>
                  <p className="text-[11px] leading-[1.3] font-medium text-ink-soft">
                    Email vérifié · {event.title}
                  </p>
                </div>
              </div>

              <p className="text-[21px] leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                Vos informations
              </p>

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
              {documentRequirements.map((requirement) => (
                <FileUploadField
                  key={requirement.key}
                  label={requirement.label}
                  instructions={requirement.instructions}
                  onFileChange={(file) => setDocumentFiles((prev) => ({ ...prev, [requirement.key]: file }))}
                />
              ))}
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
                  {event.location && (
                    <p className="pt-2 text-[13px] leading-[1.55] font-medium text-ink-soft">{event.location}</p>
                  )}
                </div>
                <div className="h-px bg-hairline" />
                <div className="flex items-center justify-between bg-date-tint px-6 py-[18px]">
                  <span className="text-[13px] leading-none font-semibold text-[oklch(0.42_0.015_260)]">
                    {documentRequirements.length > 0 ? 'Montant après validation' : 'À régler'}
                  </span>
                  <span className="text-[22px] leading-none font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {totalCents === 0 ? 'Gratuit' : euros(totalCents)}
                  </span>
                </div>
                <div className="flex flex-col gap-[10px] px-6 pt-[18px] pb-[22px]">
                  <PublicButton type="button" onClick={handleSubmit} disabled={!formValid || submitting} className="w-full">
                    {ctaLabel}
                  </PublicButton>
                  {documentRequirements.length > 0 && (
                    <p className="text-center text-[11.5px] leading-[1.5] font-medium text-ink-soft">
                      Vous ne payez pas maintenant : le paiement vient après validation du justificatif.
                    </p>
                  )}
                  {submitError && <p className="text-center text-sm text-red-600">{submitError}</p>}
                </div>
              </div>

              {documentRequirements.length > 0 && (
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

  // step === 'email' — arrivée + vérification fusionnées (écran B1)
  return (
    <motion.div key="email" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <PublicShell
        footer={
          <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)]">
            {otpSent && !emailVerified ? (
              <PublicButton
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifying || codeDigits.some((d) => !d)}
                className="w-full"
              >
                {verifying ? 'Vérification…' : 'Vérifier le code'}
              </PublicButton>
            ) : (
              <PublicButton
                type="button"
                onClick={emailVerified ? () => setStep('form') : handleRequestOtp}
                disabled={otpRequesting || !email.trim()}
                className="w-full"
              >
                {emailVerified ? 'Continuer →' : otpRequesting ? 'Envoi…' : 'Recevoir mon code →'}
              </PublicButton>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-[18px] pt-4 md:mx-auto md:max-w-md">
          <div className="flex items-center gap-[11px]">
            <div
              className="squircle flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#223499,#6f80e4)', fontFamily: 'var(--font-display)' }}
            >
              {service.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-[1.25] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                {service.name}
              </p>
              <p className="text-[11px] leading-[1.3] font-medium text-ink-soft">Inscription en ligne</p>
            </div>
          </div>

          <div>
            <p className="text-[25px] leading-[1.22] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {event.title}
            </p>
            {(event.eventDate || event.timeLabel || event.location) && (
              <p className="pt-[9px] text-[13.5px] leading-[1.5] font-semibold text-[oklch(0.4_0.02_260)]">
                {[event.eventDate, event.timeLabel].filter(Boolean).join(' · ')}
                {event.location && (
                  <>
                    <br />
                    {event.location}
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[17px] leading-[1.2] font-bold ${event.priceCents === 0 ? 'text-success' : 'text-aregie-deep'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
            </span>
            <div className="h-4 w-px bg-hairline" />
            {full ? (
              <span className="rounded-full bg-[oklch(0.93_0.008_260)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[oklch(0.45_0.015_260)]">
                Complet · liste d'attente
              </span>
            ) : event.seatsRemaining !== null ? (
              <span className="flex items-center gap-1.5 rounded-full bg-success-tint px-[11px] py-[6px] text-[11.5px] font-semibold text-[oklch(0.44_0.08_150)]">
                <span className="h-[7px] w-[7px] rounded-full bg-success" />
                Il reste {event.seatsRemaining} place{event.seatsRemaining > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          <div className="h-px bg-hairline" />

          {emailVerified ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="squircle flex items-center gap-3 rounded-2xl border-[1.5px] border-success-border bg-success-tint px-4 py-[13px]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <ShieldCheck size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] leading-none font-semibold tracking-[0.04em] text-[oklch(0.5_0.03_150)] uppercase">
                  Email
                </p>
                <p className="mt-[2px] truncate text-[14px] leading-[1.3] font-bold text-ink">{email.trim()}</p>
              </div>
              <button type="button" onClick={() => onEmailChange(email)} className="shrink-0 text-xs font-semibold text-aregie-blue">
                Modifier
              </button>
            </motion.div>
          ) : (
            <>
              <div>
                <p className="text-[17px] leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                  Commençons par votre email
                </p>
                <p className="pt-[7px] text-[13px] leading-[1.6] text-ink-soft">
                  Nous y envoyons un code, puis la confirmation de votre inscription.
                </p>
              </div>

              {!otpSent && (
                <div className="relative">
                  <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                  <TextInput
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    autoFocus
                    required
                    className="h-[54px] rounded-[14px] border-[1.5px] pl-9 text-[15px]"
                  />
                </div>
              )}
              {otpError && <p className="text-sm text-red-600">{otpError}</p>}

              {otpSent && (
                <div>
                  <div>
                    <p className="mb-[5px] text-base leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                      Code de vérification
                    </p>
                    <p className="mb-4 text-[12.5px] leading-[1.5] text-ink-soft">
                      Saisissez le code à {otpLength} chiffres reçu par email.
                      {devCode && <span className="ml-1.5 font-mono font-bold text-aregie-blue">(test : {devCode})</span>}
                    </p>
                  </div>
                  <OtpDigitInput digits={codeDigits} onChange={setCodeDigits} length={otpLength} />
                  <p className="mt-4 text-[12.5px] leading-[1.4] font-medium text-ink-faint">
                    {resendCooldown > 0 ? (
                      <>
                        Renvoyer le code dans{' '}
                        <span className="font-bold text-ink">
                          {String(Math.floor(resendCooldown / 60)).padStart(2, '0')}:{String(resendCooldown % 60).padStart(2, '0')}
                        </span>
                      </>
                    ) : (
                      <button type="button" onClick={handleRequestOtp} className="font-bold text-aregie-blue">
                        Renvoyer le code
                      </button>
                    )}
                  </p>
                  {verifyError && <p className="mt-2 text-sm text-red-600">{verifyError}</p>}
                </div>
              )}
            </>
          )}

          <div className="squircle rounded-[14px] bg-[oklch(0.97_0.012_75)] px-4 py-[13px] text-[12.5px] leading-[1.6] text-[oklch(0.45_0.02_260)]">
            Inscription en <strong className="font-bold text-aregie-deep">2 minutes</strong> · aucun compte à créer
            {event.registrationDeadline && (
              <> · vous pourrez annuler jusqu'au {new Date(event.registrationDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</>
            )}
            .
          </div>
        </div>
      </PublicShell>
    </motion.div>
  )
}

export default PublicInscriptionDirectPage
