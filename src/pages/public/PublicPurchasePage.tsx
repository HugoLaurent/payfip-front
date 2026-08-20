import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Mail, ShieldCheck, ShoppingCart } from "lucide-react";
import { apiCall, GATEWAY_URL } from "@/lib/api";
import { LoadError, TextInput } from "@/components/ui";
import { useDelayedLoading } from "@/lib/useDelayedLoading";
import { useSquircle } from "@/lib/useSquircle";
import type { ServiceLookup } from "@/lib/types";
import { PublicShell } from "@/layouts/PublicShell";
import {
  BILLETTERIE_STEPS,
  OtpDigitInput,
  PublicBottomBar,
  PublicButton,
  PublicGhostButton,
  PublicServiceHeader,
  StepIndicator,
  type StepKey,
} from "@/components/public";

interface Tariff {
  id: number;
  tariffType: string;
  priceCents: number;
}

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Maquette : boutons ronds 32px, "−" nu (bordure fine) / "+" plein bleu
// nuit, sans ombre ni état actif — pas d'icône lucide, les caractères
// eux-mêmes comme dans la maquette.
function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-[10px]">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[oklch(0.85_0.01_260)] bg-white text-[17px] leading-none font-bold text-[oklch(0.4_0.02_260)] disabled:opacity-30"
      >
        −
      </button>
      <span className="w-[22px] text-center text-[15px] leading-none font-bold text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-aregie-deep text-[17px] leading-none font-bold text-white"
      >
        +
      </button>
    </div>
  );
}

function TariffRow({
  tariff,
  quantity,
  onChange,
}: {
  tariff: Tariff;
  quantity: number;
  onChange: (value: number) => void;
}) {
  const squircle = useSquircle<HTMLDivElement>(16);
  return (
    <div
      ref={squircle.ref}
      style={squircle.style}
      className="flex items-center gap-3 rounded-2xl border-[1.5px] border-hairline px-4 py-[14px]"
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-[14.5px] leading-[1.3] font-bold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {tariff.tariffType}
        </p>
        <p className="text-[13.5px] leading-none font-bold text-price">
          {tariff.priceCents === 0 ? "Gratuit" : euros(tariff.priceCents)}
        </p>
      </div>
      <Stepper value={quantity} onChange={onChange} />
    </div>
  );
}

export function PublicPurchasePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const coverSquircle = useSquircle<HTMLDivElement>(20);
  const dateCardSquircle = useSquircle<HTMLDivElement>(16);
  const asideSquircle = useSquircle<HTMLDivElement>(18);

  const [step, setStep] = useState<StepKey>("email");

  const [service, setService] = useState<ServiceLookup | null>(null);
  const [serviceError, setServiceError] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  // Résolu hors-DOM (voir effet plus bas) avant d'être inséré dans la
  // mise en page — un enfant à hauteur 0 en attente de chargement laisse
  // quand même un espace via le gap flex du parent, ce qui provoque un
  // micro-jump au moment où il se démonte après un échec.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);
  const [tariffsFailed, setTariffsFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [visitDate, setVisitDate] = useState(todayIso());
  const [editingDate, setEditingDate] = useState(false);

  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  // OTP_MODE=fake côté serveur : le code arrive directement dans la
  // réponse (jamais le cas en mode réel), pratique pour tester sans
  // regarder les emails.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const showServiceLoading = useDelayedLoading(
    service === null && !serviceError,
  );
  const showTariffsLoading = useDelayedLoading(
    tariffs === null && !tariffsFailed,
  );

  useEffect(() => {
    if (!slug) return;
    setService(null);
    setServiceError(false);
    apiCall<{ data: ServiceLookup }>(
      "GET",
      `/billetterie/services/lookup/${slug}`,
    ).then((result) => {
      if (result.ok) setService(result.data.data);
      else setServiceError(true);
    });
  }, [slug]);

  useEffect(() => {
    if (!service) return;
    setCoverUrl(null);
    const url = `${GATEWAY_URL}/services/${service.serviceId}/cover`;
    const probe = new Image();
    probe.onload = () => setCoverUrl(url);
    probe.src = url;
  }, [service]);

  useEffect(() => {
    if (!service) return;
    setTariffs(null);
    setTariffsFailed(false);
    apiCall<{ data: Tariff[] }>(
      "GET",
      `/billetterie/tariffs?orgId=${service.orgId}&serviceId=${service.serviceId}`,
    ).then((result) => {
      if (result.ok) {
        setTariffs(result.data.data);
        setQuantities(
          Object.fromEntries(result.data.data.map((t) => [t.tariffType, 0])),
        );
      } else {
        setTariffsFailed(true);
      }
    });
  }, [service, reloadKey]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeout = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [resendCooldown]);

  const totalCents =
    tariffs?.reduce(
      (sum, t) => sum + t.priceCents * (quantities[t.tariffType] ?? 0),
      0,
    ) ?? 0;
  const qtyTotal = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalLabel =
    totalCents === 0 && qtyTotal > 0 ? "Gratuit" : euros(totalCents);
  // Aside "Récapitulatif" desktop uniquement (maquette, écran Billets 2
  // colonnes) — même logique de regroupement que le récapitulatif de la
  // page de confirmation.
  const purchasedRows =
    tariffs
      ?.filter((t) => (quantities[t.tariffType] ?? 0) > 0)
      .map((t) => {
        const count = quantities[t.tariffType] ?? 0;
        const lineCents = t.priceCents * count;
        return {
          label: t.tariffType,
          count,
          lineLabel: lineCents === 0 ? "Gratuit" : euros(lineCents),
        };
      }) ?? [];

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailVerified || otpSent) {
      setEmailVerified(false);
      setOtpSent(false);
      setCodeDigits(Array(OTP_LENGTH).fill(""));
      setOtpError(null);
      setVerifyError(null);
      setResendCooldown(0);
      setDevCode(null);
    }
  }

  async function handleRequestOtp() {
    if (!service || !email.trim()) return;
    setOtpRequesting(true);
    setOtpError(null);
    const result = await apiCall<{ data: { devCode?: string } }>(
      "POST",
      "/billetterie/otp/request",
      { body: { orgId: service.orgId, email: email.trim() } },
    );
    setOtpRequesting(false);
    if (result.ok) {
      setOtpSent(true);
      setResendCooldown(RESEND_COOLDOWN_S);
      // Uniquement présent quand OTP_MODE=fake côté serveur (jamais en
      // mode réel) — pas besoin de flag front séparé pour l'afficher.
      setDevCode(result.data.data.devCode ?? null);
    } else if (result.status === 429) {
      setOtpError("Trop de demandes — merci de patienter avant de réessayer.");
    } else {
      setOtpError("Échec de l'envoi du code.");
    }
  }

  async function handleVerifyOtp() {
    if (!service) return;
    setVerifying(true);
    setVerifyError(null);
    const result = await apiCall("POST", "/billetterie/otp/verify", {
      body: {
        orgId: service.orgId,
        email: email.trim(),
        code: codeDigits.join(""),
      },
    });
    setVerifying(false);
    if (result.ok) {
      setEmailVerified(true);
    } else if (result.status === 429) {
      setVerifyError("Trop de tentatives — demandez un nouveau code.");
    } else {
      setVerifyError("Code invalide ou expiré.");
    }
  }

  // Valide automatiquement dès que les 6 chiffres sont remplis (saisie ou
  // collage) — le bouton "Vérifier le code" reste utilisable en secours
  // (ex. pour relancer après une erreur sans retoucher les chiffres).
  useEffect(() => {
    if (
      otpSent &&
      !emailVerified &&
      !verifying &&
      codeDigits.every((d) => d !== "")
    ) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeDigits]);

  async function handleSubmit() {
    if (!service || qtyTotal === 0 || !emailVerified) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await apiCall<{
      data:
        | {
            orderId: number;
            paymentReference: string;
            accessToken: string;
            status: "confirmed";
            free: true;
            message: string;
          }
        | {
            orderId: number;
            status: "awaiting_payment";
            paymentUrl: string;
            payfipIdOp: string;
          };
    }>("POST", "/billetterie/orders", {
      body: {
        orgId: service.orgId,
        serviceId: service.serviceId,
        email: email.trim(),
        visitDate,
        tickets: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([tariffType, quantity]) => ({ tariffType, quantity })),
        frontRedirectUrl: `${window.location.origin}/billetterie/${slug}/retour`,
      },
    });

    if (result.ok) {
      if (result.data.data.status === "confirmed") {
        // Même page de résumé/téléchargement que le retour PayFiP — une
        // commande gratuite n'a pas de payfipIdOp, on utilise l'accessToken
        // généré à la création comme preuve de possession à sa place.
        const d = result.data.data;
        navigate(
          `/billetterie/${slug}/retour?idop=${d.accessToken}&status=confirmed&orgId=${service.orgId}&sourceReference=${d.paymentReference}&message=${encodeURIComponent(d.message)}&email=${encodeURIComponent(email.trim())}`,
        );
      } else {
        // Redirige entièrement hors de la SPA vers la page de paiement
        // PayFiP — pas la peine de repasser `submitting` à false, la
        // page va changer.
        window.location.href = result.data.data.paymentUrl;
      }
      return;
    }

    setSubmitting(false);
    if (result.status === 403) {
      setSubmitError(
        "Cet email n'a pas été vérifié — recommencez la vérification par code.",
      );
      setEmailVerified(false);
    } else if (result.status === 409) {
      setSubmitError(
        "Ce service est fermé — impossible de commander pour le moment.",
      );
    } else if (result.status === 422) {
      setSubmitError("Un des tarifs sélectionnés est invalide.");
    } else {
      setSubmitError("Échec de la commande.");
    }
  }

  if (serviceError) {
    return (
      <PublicShell>
        <p className="pt-10 text-center text-sm text-ink-soft">
          Service introuvable — vérifiez le lien qui vous a été communiqué.
        </p>
      </PublicShell>
    );
  }

  if (!service) {
    return (
      <PublicShell>
        {showServiceLoading && (
          <p className="pt-10 text-center text-sm text-ink-soft">Chargement…</p>
        )}
      </PublicShell>
    );
  }

  if (step === "email") {
    return (
      <motion.div
        key="email"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <PublicShell
          header={
            <div className="md:mx-auto md:w-full md:max-w-md">
              <PublicServiceHeader
                service={service}
                logoFailed={logoFailed}
                onLogoFail={() => setLogoFailed(true)}
              />
              <div className="pt-[2px] pb-5">
                <StepIndicator steps={BILLETTERIE_STEPS} current="email" />
              </div>
            </div>
          }
          footer={
            // Pas de total de billets ici : c'est le tout premier écran,
            // rien n'est encore choisi — juste le bouton d'action, pleine
            // largeur, même traitement visuel que PublicBottomBar.
            <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
              {otpSent && !emailVerified ? (
                <PublicButton
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifying || codeDigits.some((d) => !d)}
                  className="w-full"
                >
                  {verifying ? "Vérification…" : "Vérifier le code"}
                </PublicButton>
              ) : (
                <PublicButton
                  type="button"
                  onClick={() => setStep("tickets")}
                  disabled={!emailVerified}
                  className="w-full"
                >
                  Continuer →
                </PublicButton>
              )}
            </div>
          }
        >
          <div className="flex flex-col gap-[22px] md:mx-auto md:max-w-md">
            {coverUrl && (
              <motion.div
                ref={coverSquircle.ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={coverSquircle.style}
                className="hidden h-[180px] w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:block"
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={coverUrl} className="h-full w-full object-cover" />
              </motion.div>
            )}
            <p className="text-[13.5px] leading-[1.6] text-[oklch(0.48_0.015_260)]">
              Avant de choisir vos billets, nous vérifions votre adresse email.
              Vos billets vous y seront envoyés.
            </p>

            {emailVerified ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex items-center gap-3 rounded-2xl border-[1.5px] border-success-border bg-success-tint px-4 py-[13px]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <ShieldCheck size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] leading-none font-semibold tracking-[0.04em] text-[oklch(0.5_0.03_150)] uppercase">
                    Email
                  </p>
                  <p className="mt-[2px] truncate text-[14px] leading-[1.3] font-bold text-ink">
                    {email.trim()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEmailChange(email)}
                  className="shrink-0 text-xs font-semibold text-aregie-blue"
                >
                  Modifier
                </button>
              </motion.div>
            ) : (
              <div className="space-y-2.5">
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                  />
                  <TextInput
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
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
                    {otpRequesting ? "Envoi…" : "Envoyer le code"}
                  </PublicGhostButton>
                )}
                {otpError && <p className="text-sm text-red-600">{otpError}</p>}
              </div>
            )}

            {otpSent && !emailVerified && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p
                  className="mb-[5px] text-base leading-[1.3] font-bold text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Code de vérification
                </p>
                <p className="mb-4 text-[12.5px] leading-[1.5] text-ink-soft">
                  Saisissez le code à {OTP_LENGTH} chiffres reçu par email.
                  {devCode && (
                    <span className="ml-1.5 font-mono font-bold text-aregie-blue">
                      (test : {devCode})
                    </span>
                  )}
                </p>
                <OtpDigitInput
                  digits={codeDigits}
                  onChange={setCodeDigits}
                  length={OTP_LENGTH}
                />
                <p className="mt-4 text-[12.5px] leading-[1.4] font-medium text-ink-faint">
                  {resendCooldown > 0 ? (
                    <>
                      Renvoyer le code dans{" "}
                      <span className="font-bold text-ink">
                        {String(Math.floor(resendCooldown / 60)).padStart(
                          2,
                          "0",
                        )}
                        :{String(resendCooldown % 60).padStart(2, "0")}
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="font-bold text-aregie-blue"
                    >
                      Renvoyer le code
                    </button>
                  )}
                </p>
                {verifyError && (
                  <p className="mt-2 text-sm text-red-600">{verifyError}</p>
                )}
              </motion.div>
            )}

            {/* Desktop : pas de barre basse fixe (voir maquette, mobile
                uniquement — footer masqué via md:hidden ci-dessus), le
                bouton d'action vit directement dans le flux. */}
            <div className="hidden md:flex md:justify-end">
              {otpSent && !emailVerified ? (
                <PublicButton
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifying || codeDigits.some((d) => !d)}
                >
                  {verifying ? "Vérification…" : "Vérifier le code"}
                </PublicButton>
              ) : (
                <PublicButton
                  type="button"
                  onClick={() => setStep("tickets")}
                  disabled={!emailVerified}
                >
                  Continuer →
                </PublicButton>
              )}
            </div>
          </div>
        </PublicShell>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="tickets"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <PublicShell
        header={
          <div className="md:mx-auto md:w-full md:max-w-[1040px]">
            <PublicServiceHeader
              service={service}
              logoFailed={logoFailed}
              onLogoFail={() => setLogoFailed(true)}
              onBack={() => setStep("email")}
            />
            <div className="px-6 pt-[2px] pb-4">
              <StepIndicator steps={BILLETTERIE_STEPS} current="tickets" />
            </div>
          </div>
        }
        footer={
          <div className="md:hidden">
            <PublicBottomBar count={qtyTotal} totalLabel={totalLabel}>
              <PublicButton
                type="button"
                onClick={handleSubmit}
                disabled={qtyTotal === 0 || submitting}
              >
                <ShoppingCart size={15} />
                {submitting ? "Validation…" : "Commander →"}
              </PublicButton>
            </PublicBottomBar>
          </div>
        }
      >
        {/* Desktop (maquette, écran Billets 2 colonnes) : colonne principale
          + aside "Récapitulatif" sticky qui remplace la barre basse
          mobile (masquée via md:hidden sur le footer ci-dessus). */}
        <div className="md:mx-auto md:flex md:w-full md:max-w-[1040px] md:items-start md:gap-9 md:px-6">
          <div className="flex flex-1 flex-col gap-[18px] md:min-w-0">
            {coverUrl && (
              <motion.div
                ref={coverSquircle.ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={coverSquircle.style}
                className="hidden h-[180px] w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:block"
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={coverUrl} className="h-full w-full object-cover" />
              </motion.div>
            )}
            <div
              ref={dateCardSquircle.ref}
              style={dateCardSquircle.style}
              className="flex items-center gap-3 rounded-2xl bg-date-tint px-4 py-[14px]"
            >
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-aregie-blue text-white">
                <Calendar size={16} />
              </div>
              {editingDate ? (
                <TextInput
                  type="date"
                  autoFocus
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  onBlur={() => setEditingDate(false)}
                  className="flex-1"
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="mb-[3px] text-[10.5px] leading-none font-semibold tracking-[0.04em] text-[oklch(0.5_0.02_250)] uppercase">
                    Date de visite
                  </p>
                  <p
                    className="text-[15px] leading-[1.2] font-bold text-ink"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {formatDateLabel(visitDate)}
                  </p>
                </div>
              )}
              {!editingDate && (
                <button
                  type="button"
                  onClick={() => setEditingDate(true)}
                  className="shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-aregie-blue"
                >
                  Modifier
                </button>
              )}
            </div>

            <div>
              <p
                className="mb-[2px] text-[17px] leading-[1.3] font-bold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Choisissez vos billets
              </p>
              <p className="mb-[14px] text-[12.5px] leading-[1.5] text-ink-soft">
                Pour la journée du {formatDateLabel(visitDate)}
              </p>

              {tariffsFailed && (
                <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
              )}
              {!tariffsFailed && showTariffsLoading && (
                <p className="text-sm text-ink-soft">Chargement des tarifs…</p>
              )}
              {!tariffsFailed && tariffs?.length === 0 && (
                <p className="text-sm text-ink-soft">
                  Aucun tarif disponible pour ce service.
                </p>
              )}

              <div className="flex flex-col gap-[10px]">
                {tariffs?.map((t) => (
                  <TariffRow
                    key={t.id}
                    tariff={t}
                    quantity={quantities[t.tariffType] ?? 0}
                    onChange={(v) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [t.tariffType]: v,
                      }))
                    }
                  />
                ))}
              </div>

              {submitError && (
                <p className="mt-3 text-sm text-red-600">{submitError}</p>
              )}
            </div>
          </div>

          <div
            ref={asideSquircle.ref}
            style={asideSquircle.style}
            className="hidden md:sticky md:top-5 md:flex md:w-[320px] md:flex-none md:flex-col md:gap-4 md:rounded-[18px] md:bg-aside-bg md:p-[22px]"
          >
            <p
              className="text-[15px] leading-[1.3] font-bold text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Récapitulatif
            </p>
            <div className="flex flex-col gap-2">
              {purchasedRows.length === 0 ? (
                <p className="text-[12.5px] text-ink-soft">
                  Aucun billet sélectionné
                </p>
              ) : (
                purchasedRows.map((r) => (
                  <div
                    key={r.label}
                    className="flex justify-between text-[12.5px] font-medium text-[oklch(0.4_0.02_260)]"
                  >
                    <span>
                      {r.count} × {r.label}
                    </span>
                    <span className="font-bold text-ink">{r.lineLabel}</span>
                  </div>
                ))
              )}
            </div>
            <div className="border-t-[1.5px] border-dashed border-[oklch(0.85_0.01_260)]" />
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-semibold text-ink-soft">
                Total
              </span>
              <span
                className="text-[22px] leading-none font-extrabold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {totalLabel}
              </span>
            </div>
            <PublicButton
              type="button"
              onClick={handleSubmit}
              disabled={qtyTotal === 0 || submitting}
              className="w-full"
            >
              {submitting ? "Validation…" : "Commander →"}
            </PublicButton>
          </div>
        </div>
      </PublicShell>
    </motion.div>
  );
}

export default PublicPurchasePage
