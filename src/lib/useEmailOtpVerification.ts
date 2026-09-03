import { useEffect, useState } from 'react'
import { apiCall } from './api'

const OTP_LENGTH = 6
const RESEND_COOLDOWN_S = 60

// Flux email/OTP partagé par les parcours billetterie et facture — seuls
// les chemins d'API changent (/billetterie/otp/* vs /factures/otp/*).
export function useEmailOtpVerification({
  orgId,
  requestPath,
  verifyPath,
  initialEmail,
}: {
  orgId: number | null
  requestPath: string
  verifyPath: string
  // Préremplissage démo (widget bas-droit, ?demoEmail=... sur le lien de
  // parcours) — évite de taper une adresse en direct devant un client.
  // Jamais deviné : seulement la valeur exacte passée par l'appelant.
  initialEmail?: string
}) {
  const [email, setEmailValue] = useState(initialEmail ?? '')
  const [otpSent, setOtpSent] = useState(false)
  const [otpRequesting, setOtpRequesting] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  // OTP_MODE=fake côté serveur : le code arrive directement dans la
  // réponse (jamais le cas en mode réel), pratique pour tester sans
  // regarder les emails.
  const [devCode, setDevCode] = useState<string | null>(null)
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timeout = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timeout)
  }, [resendCooldown])

  // Sert aussi de bouton "Modifier" une fois l'email vérifié : rappelé
  // avec la même valeur, il ne fait que réinitialiser l'état de
  // vérification pour revenir en mode édition.
  function onEmailChange(value: string) {
    setEmailValue(value)
    if (emailVerified || otpSent) {
      setEmailVerified(false)
      setOtpSent(false)
      setCodeDigits(Array(OTP_LENGTH).fill(''))
      setOtpError(null)
      setVerifyError(null)
      setResendCooldown(0)
      setDevCode(null)
    }
  }

  async function handleRequestOtp() {
    if (!orgId || !email.trim()) return
    setOtpRequesting(true)
    setOtpError(null)
    const result = await apiCall<{ data: { devCode?: string } }>('POST', requestPath, {
      body: { orgId, email: email.trim() },
    })
    setOtpRequesting(false)
    if (result.ok) {
      setOtpSent(true)
      setResendCooldown(RESEND_COOLDOWN_S)
      setDevCode(result.data.data.devCode ?? null)
    } else if (result.status === 429) {
      setOtpError('Trop de demandes — merci de patienter avant de réessayer.')
    } else {
      setOtpError("Échec de l'envoi du code.")
    }
  }

  async function handleVerifyOtp() {
    if (!orgId) return
    setVerifying(true)
    setVerifyError(null)
    const result = await apiCall('POST', verifyPath, {
      body: { orgId, email: email.trim(), code: codeDigits.join('') },
    })
    setVerifying(false)
    if (result.ok) {
      setEmailVerified(true)
    } else if (result.status === 429) {
      setVerifyError('Trop de tentatives — demandez un nouveau code.')
    } else {
      setVerifyError('Code invalide ou expiré.')
    }
  }

  // Valide automatiquement dès que les 6 chiffres sont remplis (saisie ou
  // collage) — le bouton "Vérifier le code" reste utilisable en secours
  // (ex. pour relancer après une erreur sans retoucher les chiffres).
  useEffect(() => {
    if (otpSent && !emailVerified && !verifying && codeDigits.every((d) => d !== '')) {
      handleVerifyOtp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeDigits])

  return {
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
    setEmailVerified,
    resendCooldown,
    handleRequestOtp,
    handleVerifyOtp,
    otpLength: OTP_LENGTH,
  }
}

export type EmailOtpState = ReturnType<typeof useEmailOtpVerification>
