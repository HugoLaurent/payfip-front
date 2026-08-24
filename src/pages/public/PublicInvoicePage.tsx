import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { apiCall, GATEWAY_URL } from "@/lib/api";
import { TextInput } from "@/components/ui";
import { useDelayedLoading } from "@/lib/useDelayedLoading";
import { euros } from "@/lib/format";
import { useEmailOtpVerification } from "@/lib/useEmailOtpVerification";
import type { ServiceLookup } from "@/lib/types";
import { PublicShell } from "@/layouts/PublicShell";
import {
  EmailVerificationStep,
  INVOICE_STEPS,
  PublicButton,
  PublicGhostButton,
  PublicServiceHeader,
  ServiceClosedScreen,
  StepIndicator,
  type InvoiceStepKey,
} from "@/components/public";

interface InvoiceProof {
  hospitalReference: string;
  fiscalYear: number;
  amountCents: number;
}

interface InvoiceSummary {
  id: number;
  status: string;
  amountCents: number;
  objectLabel: string;
  clientNumber: string | null;
  fiscalYear: number;
}

const INVOICE_STATUS_MESSAGES: Record<string, string> = {
  confirmed: "Cette facture a déjà été réglée.",
  awaiting_payment: "Un paiement est déjà en cours pour cette facture.",
  cancelled:
    "Cette facture n'est plus payable en ligne — contactez l'organisme.",
};

// Accepte "42,50" ou "42.50" (voire "42") — le format que la plupart des
// gens tapent naturellement au clavier français.
function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

const CURRENT_YEAR = new Date().getFullYear();

export function PublicInvoicePage() {
  const { slug } = useParams<{ slug: string }>();

  // Comme la billetterie : on vérifie l'email en premier, avant de laisser
  // l'usager retrouver sa facture.
  const [step, setStep] = useState<InvoiceStepKey>("email");

  const [service, setService] = useState<ServiceLookup | null>(null);
  const [serviceError, setServiceError] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [hospitalReference, setHospitalReference] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(CURRENT_YEAR));
  const [amountInput, setAmountInput] = useState("");
  const [verifyingInvoice, setVerifyingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [proof, setProof] = useState<InvoiceProof | null>(null);

  const otp = useEmailOtpVerification({
    orgId: service?.orgId ?? null,
    requestPath: "/factures/otp/request",
    verifyPath: "/factures/otp/verify",
  });
  const { email, emailVerified, setEmailVerified } = otp;

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const showServiceLoading = useDelayedLoading(
    service === null && !serviceError,
  );

  useEffect(() => {
    if (!slug) return;
    setService(null);
    setServiceError(false);
    apiCall<{ data: ServiceLookup }>(
      "GET",
      `/factures/services/lookup/${slug}`,
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

  async function handleVerifyInvoice() {
    if (!service) return;
    const cents = parseAmountToCents(amountInput);
    const year = Number(fiscalYear);
    if (!hospitalReference.trim() || !cents || !year) return;

    setVerifyingInvoice(true);
    setInvoiceError(null);

    const result = await apiCall<{ data: InvoiceSummary }>(
      "POST",
      "/factures/verify",
      {
        body: {
          orgId: service.orgId,
          hospitalReference: hospitalReference.trim(),
          fiscalYear: year,
          amountCents: cents,
        },
      },
    );

    setVerifyingInvoice(false);

    if (!result.ok) {
      setInvoiceError(
        "Aucune facture ne correspond à ces informations. Vérifiez la référence, l'année et le montant.",
      );
      return;
    }

    const found = result.data.data;
    if (found.status !== "draft") {
      setInvoiceError(
        INVOICE_STATUS_MESSAGES[found.status] ??
          "Cette facture n'est pas payable en ligne.",
      );
      return;
    }

    setInvoice(found);
    setProof({
      hospitalReference: hospitalReference.trim(),
      fiscalYear: year,
      amountCents: cents,
    });
  }

  async function handlePay() {
    if (!service || !invoice || !proof || !emailVerified) return;

    setPaying(true);
    setPayError(null);

    const result = await apiCall<{ data: { paymentUrl: string } }>(
      "POST",
      `/factures/${invoice.id}/pay`,
      {
        body: {
          orgId: service.orgId,
          frontRedirectUrl: `${window.location.origin}/factures/${slug}/retour`,
          payerEmail: email.trim(),
          fiscalYear: proof.fiscalYear,
          amountCents: proof.amountCents,
        },
      },
    );

    if (result.ok) {
      window.location.href = result.data.data.paymentUrl;
      return;
    }

    setPaying(false);
    if (result.status === 403) {
      setPayError(
        "Cet email n'a pas été vérifié — recommencez la vérification par code.",
      );
      setEmailVerified(false);
    } else if (result.status === 409) {
      setPayError("Cette facture n'est plus payable en ligne.");
    } else {
      setPayError("Échec de la mise en paiement.");
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
        steps={INVOICE_STEPS}
        coverUrl={coverUrl}
        introText="Avant de retrouver votre facture, nous vérifions votre adresse email."
        otp={otp}
        onContinue={() => setStep("reference")}
      />
    );
  }

  return (
    <motion.div
      key="reference"
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
              onBack={() => setStep("email")}
            />
            <div className="pt-[2px] pb-5">
              <StepIndicator steps={INVOICE_STEPS} current="reference" />
            </div>
          </div>
        }
        footer={
          invoice &&
          proof && (
            <div className="bg-white px-6 pt-[14px] pb-[22px] shadow-[0_-8px_24px_-12px_rgba(20,25,60,0.15)] md:hidden">
              <PublicButton
                type="button"
                onClick={handlePay}
                disabled={paying}
                className="w-full"
              >
                {paying
                  ? "Redirection…"
                  : `Payer ${euros(proof.amountCents)} →`}
              </PublicButton>
            </div>
          )
        }
      >
        <div className="flex flex-col gap-[22px] md:mx-auto md:max-w-md">
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

          <p className="text-[13.5px] leading-[1.6] text-[oklch(0.48_0.015_260)]">
            Retrouvez votre facture avec les informations indiquées dessus :
            référence, année et montant.
          </p>

          {invoice && proof ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="squircle flex items-center gap-3 rounded-2xl border-[1.5px] border-success-border bg-success-tint px-4 py-[13px]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <FileSearch size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] leading-none font-semibold tracking-[0.04em] text-[oklch(0.5_0.03_150)] uppercase">
                  {invoice.objectLabel}
                </p>
                <p className="mt-[2px] truncate text-[14px] leading-[1.3] font-bold text-ink">
                  Réf. {proof.hospitalReference} — {euros(invoice.amountCents)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInvoice(null);
                  setProof(null);
                }}
                className="shrink-0 text-xs font-semibold text-aregie-blue"
              >
                Modifier
              </button>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <p className="mb-[5px] text-[12.5px] font-semibold text-ink-soft">
                  Référence
                </p>
                <TextInput
                  type="text"
                  placeholder="Ex. 20260001234"
                  value={hospitalReference}
                  onChange={(e) => setHospitalReference(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <p className="mb-[5px] text-[12.5px] font-semibold text-ink-soft">
                    Année
                  </p>
                  <TextInput
                    type="number"
                    placeholder={String(CURRENT_YEAR)}
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <p className="mb-[5px] text-[12.5px] font-semibold text-ink-soft">
                    Montant
                  </p>
                  <TextInput
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00 €"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    required
                  />
                </div>
              </div>
              <PublicGhostButton
                type="button"
                onClick={handleVerifyInvoice}
                disabled={
                  verifyingInvoice ||
                  !hospitalReference.trim() ||
                  !fiscalYear ||
                  !parseAmountToCents(amountInput)
                }
                className="w-full"
              >
                {verifyingInvoice ? "Recherche…" : "Rechercher →"}
              </PublicGhostButton>
              {invoiceError && (
                <p className="text-sm text-red-600">{invoiceError}</p>
              )}
            </div>
          )}

          {payError && <p className="text-sm text-red-600">{payError}</p>}

          {invoice && proof && (
            <div className="hidden md:flex md:justify-end">
              <PublicButton type="button" onClick={handlePay} disabled={paying}>
                {paying
                  ? "Redirection…"
                  : `Payer ${euros(proof.amountCents)} →`}
              </PublicButton>
            </div>
          )}
        </div>
      </PublicShell>
    </motion.div>
  );
}

export default PublicInvoicePage
