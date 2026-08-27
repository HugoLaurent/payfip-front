import { motion } from 'framer-motion'
import { Mail, ShieldCheck } from 'lucide-react'
import { TextInput } from '@/components/ui'
import { PublicShell } from '@/layouts/PublicShell'
import type { EmailOtpState } from '@/lib/useEmailOtpVerification'
import type { ServiceLookup } from '@/lib/types'
import { OtpDigitInput } from './OtpDigitInput'
import { PublicButton } from './PublicButtons'
import { PublicGhostButton } from './PublicButtons'
import { PublicServiceHeader } from './PublicServiceHeader'
import { StepIndicator } from './StepIndicator'

// Écran "Email" — identique entre le parcours billetterie et le parcours
// facture (seuls le libellé d'intro, les étapes affichées et la
// destination du bouton "Continuer" changent), d'où l'extraction.
export function EmailVerificationStep({
  service,
  logoFailed,
  onLogoFail,
  steps,
  coverUrl,
  introText,
  otp,
  onContinue,
  onBack,
}: {
  service: ServiceLookup
  logoFailed: boolean
  onLogoFail: () => void
  steps: readonly { key: string; label: string }[]
  coverUrl: string | null
  introText: string
  otp: EmailOtpState
  onContinue: () => void
  onBack?: () => void
}) {
  const {
    email,
    onEmailChange,
    otpSent,
    otpRequesting,
    otpError,
    devCode,
    codeDigits,
    setCodeDigits,
    verifying,
    verifyError,
    emailVerified,
    resendCooldown,
    handleRequestOtp,
    handleVerifyOtp,
    otpLength,
  } = otp

  function renderContinueButton(fullWidth: boolean) {
    const className = fullWidth ? 'w-full' : undefined
    return otpSent && !emailVerified ? (
      <PublicButton
        type="button"
        onClick={handleVerifyOtp}
        disabled={verifying || codeDigits.some((d) => !d)}
        className={className}
      >
        {verifying ? 'Vérification…' : 'Vérifier le code'}
      </PublicButton>
    ) : (
      <PublicButton type="button" onClick={onContinue} disabled={!emailVerified} className={className}>
        Continuer →
      </PublicButton>
    )
  }

  return (
    <motion.div key="email" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <PublicShell
        header={
          <div className="md:mx-auto md:w-full md:max-w-md">
            <PublicServiceHeader service={service} logoFailed={logoFailed} onLogoFail={onLogoFail} onBack={onBack} />
            <div className="pt-[2px] pb-5">
              <StepIndicator steps={steps} current="email" />
            </div>
          </div>
        }
        footer={
          // Pas de total de billets ici : c'est le tout premier écran,
          // rien n'est encore choisi — juste le bouton d'action, pleine
          // largeur, même traitement visuel que PublicBottomBar.
          <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
            {renderContinueButton(true)}
          </div>
        }
      >
        <div className="flex flex-col gap-[22px] md:mx-auto md:max-w-md">
          {coverUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="squircle hidden h-[180px] w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:block"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={coverUrl} className="h-full w-full object-cover" />
            </motion.div>
          )}
          <p className="text-[13.5px] leading-[1.6] text-[oklch(0.48_0.015_260)]">{introText}</p>

          {emailVerified ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
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
              <button
                type="button"
                onClick={() => onEmailChange(email)}
                className="shrink-0 text-xs font-semibold text-aregie-blue"
              >
                Modifier
              </button>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              <div className="relative">
                <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                <TextInput
                  type="email"
                  placeholder="vous@exemple.fr"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  autoFocus
                  required
                  className="pl-9"
                />
              </div>
              {!otpSent && (
                <PublicGhostButton
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpRequesting || !email.trim()}
                  className="w-full"
                >
                  {otpRequesting ? 'Envoi…' : 'Envoyer le code'}
                </PublicGhostButton>
              )}
              {otpError && <p className="text-sm text-red-600">{otpError}</p>}
            </div>
          )}

          {otpSent && !emailVerified && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <p className="mb-[5px] text-base leading-[1.3] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                Code de vérification
              </p>
              <p className="mb-4 text-[12.5px] leading-[1.5] text-ink-soft">
                Saisissez le code à {otpLength} chiffres reçu par email.
                {devCode && <span className="ml-1.5 font-mono font-bold text-aregie-blue">(test : {devCode})</span>}
              </p>
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
            </motion.div>
          )}

          {/* Desktop : pas de barre basse fixe (voir maquette, mobile
              uniquement — footer masqué via md:hidden ci-dessus), le
              bouton d'action vit directement dans le flux. */}
          <div className="hidden md:flex md:justify-end">{renderContinueButton(false)}</div>
        </div>
      </PublicShell>
    </motion.div>
  )
}
