import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, ShoppingCart } from "lucide-react";
import { apiCall, GATEWAY_URL } from "@/lib/api";
import { LoadError } from "@/components/ui";
import { useDelayedLoading } from "@/lib/useDelayedLoading";
import { euros } from "@/lib/format";
import { useEmailOtpVerification } from "@/lib/useEmailOtpVerification";
import type { ServiceLookup } from "@/lib/types";
import { PublicShell } from "@/layouts/PublicShell";
import {
  BILLETTERIE_STEPS,
  EmailVerificationStep,
  PublicBottomBar,
  PublicButton,
  PublicServiceHeader,
  ServiceClosedScreen,
  StepIndicator,
  VisitDateCalendar,
  type StepKey,
} from "@/components/public";

interface Tariff {
  id: number;
  tariffType: string;
  priceCents: number;
}

// Toujours formater une date LOCALE en "YYYY-MM-DD" via ses composantes
// (jamais `.toISOString()`, qui convertit en UTC — décale d'un jour en
// arrière tôt le matin dans un fuseau positif comme Europe/Paris, ex.
// minuit local un 24 devient 22h UTC la veille, donc "23").
function toLocalIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return toLocalIso(new Date());
}

type ClosurePeriod = { startDate: string; endDate: string };

function isDateInClosure(closures: ClosurePeriod[], iso: string): boolean {
  return closures.some((c) => iso >= c.startDate && iso <= c.endDate);
}

// Même règle que isVisitDateOpen/isVisitDateInClosure côté svc-billetterie
// — jamais bloquer la page (voir `service.isOpen`, indépendant des jours
// hebdo/fermetures futures), seulement la date de visite choisie ici.
function isDateOpen(
  openingDays: number[] | null,
  closures: ClosurePeriod[],
  iso: string,
): boolean {
  if (isDateInClosure(closures, iso)) return false;
  if (!openingDays) return true;
  const jsDay = new Date(`${iso}T00:00:00`).getDay();
  const isoWeekday = jsDay === 0 ? 7 : jsDay;
  return openingDays.includes(isoWeekday);
}

// Si "aujourd'hui" tombe un jour fermé (hebdo ou fermeture ponctuelle),
// autant proposer directement le prochain jour ouvert par défaut plutôt
// que de faire atterrir l'usager sur une date déjà invalide — borné à 30
// jours pour ne jamais boucler.
function nextOpenDate(
  openingDays: number[] | null,
  closures: ClosurePeriod[],
  fromIso: string,
): string {
  if (!openingDays && closures.length === 0) return fromIso;
  let d = new Date(`${fromIso}T00:00:00`);
  for (let i = 0; i < 30; i++) {
    if (isDateOpen(openingDays, closures, toLocalIso(d))) return toLocalIso(d);
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return fromIso;
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
        className="squircle flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[oklch(0.85_0.01_260)] bg-white text-[17px] leading-none font-bold text-[oklch(0.4_0.02_260)] disabled:opacity-30"
      >
        −
      </button>
      <span className="w-[22px] text-center text-[15px] leading-none font-bold text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="squircle flex h-8 w-8 items-center justify-center rounded-full bg-aregie-deep text-[17px] leading-none font-bold text-white"
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
  return (
    <div className="squircle flex items-center gap-3 rounded-2xl border-[1.5px] border-hairline px-4 py-[14px]">
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

  const otp = useEmailOtpVerification({
    orgId: service?.orgId ?? null,
    requestPath: "/billetterie/otp/request",
    verifyPath: "/billetterie/otp/verify",
  });
  const { email, emailVerified, setEmailVerified } = otp;

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
    setVisitDate((current) => nextOpenDate(service.openingDays, service.closures, current));
  }, [service]);

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

  const totalCents =
    tariffs?.reduce(
      (sum, t) => sum + t.priceCents * (quantities[t.tariffType] ?? 0),
      0,
    ) ?? 0;
  const qtyTotal = Object.values(quantities).reduce((a, b) => a + b, 0);
  const visitDateOpen = isDateOpen(service?.openingDays ?? null, service?.closures ?? [], visitDate);
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

  async function handleSubmit() {
    if (!service || qtyTotal === 0 || !emailVerified || !visitDateOpen) return;

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
    const errorCode = (result.data as { error?: string } | null)?.error;
    if (result.status === 403) {
      setSubmitError(
        "Cet email n'a pas été vérifié — recommencez la vérification par code.",
      );
      setEmailVerified(false);
    } else if (result.status === 409) {
      setSubmitError(
        "Ce service est fermé — impossible de commander pour le moment.",
      );
    } else if (result.status === 422 && errorCode === "visit_date_closed") {
      setSubmitError(
        "Ce jour n'est pas ouvert à la visite — choisissez une autre date.",
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

  if (!service.isOpen) {
    return (
      <ServiceClosedScreen
        service={service}
        logoFailed={logoFailed}
        onLogoFail={() => setLogoFailed(true)}
      />
    );
  }

  if (step === "email") {
    return (
      <EmailVerificationStep
        service={service}
        logoFailed={logoFailed}
        onLogoFail={() => setLogoFailed(true)}
        steps={BILLETTERIE_STEPS}
        coverUrl={coverUrl}
        introText="Avant de choisir vos billets, nous vérifions votre adresse email. Vos billets vous y seront envoyés."
        otp={otp}
        onContinue={() => setStep("tickets")}
      />
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
                disabled={qtyTotal === 0 || submitting || !visitDateOpen}
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="squircle hidden h-[180px] w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:block"
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={coverUrl} className="h-full w-full object-cover" />
              </motion.div>
            )}
            <div className="relative">
              <div className="squircle flex items-center gap-3 rounded-2xl bg-date-tint px-4 py-[14px]">
                <div className="squircle flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-aregie-blue text-white">
                  <Calendar size={16} />
                </div>
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
                <button
                  type="button"
                  onClick={() => setEditingDate((v) => !v)}
                  className="shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-aregie-blue"
                >
                  Modifier
                </button>
              </div>
              {editingDate && (
                <VisitDateCalendar
                  value={visitDate}
                  onChange={setVisitDate}
                  openingDays={service.openingDays}
                  closures={service.closures}
                  minDate={todayIso()}
                  onClose={() => setEditingDate(false)}
                />
              )}
            </div>
            {!visitDateOpen && (
              <p className="-mt-3 text-[12.5px] font-medium text-red-600">
                Ce jour n'est pas ouvert à la visite — choisissez une autre date.
              </p>
            )}

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

          <div className="squircle hidden md:sticky md:top-5 md:flex md:w-[320px] md:flex-none md:flex-col md:gap-4 md:rounded-[18px] md:bg-aside-bg md:p-[22px]">
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
              disabled={qtyTotal === 0 || submitting || !visitDateOpen}
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
