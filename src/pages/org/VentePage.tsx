import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Gift,
  Mail,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  Send,
  ShoppingCart,
} from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { Card, LoadError, PageHeader, PrimaryButton, SecondaryButton, SelectInput, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'

interface Tariff {
  id: number
  tariffType: string
  priceCents: number
}

interface SoldTicket {
  id: number
  tariffType: string
  visitDate: string
  code: string
}

interface SaleResult {
  orderId: number
  paymentReference: string | null
  email: string
  visitDate: string
  paymentMethod: string
  tickets: SoldTicket[]
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'Carte', icon: CreditCard },
  { value: 'check', label: 'Chèque', icon: FileText },
  { value: 'other', label: 'Autre', icon: MoreHorizontal },
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  check: 'Chèque',
  other: 'Autre',
  free: 'Gratuit',
}

// Composantes LOCALES, jamais `.toISOString()` (UTC) — décale d'un jour en
// arrière tôt le matin dans un fuseau positif comme Europe/Paris.
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Stepper({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 active:scale-95 disabled:opacity-30"
      >
        <Minus size={16} />
      </button>
      <span
        className={`w-6 text-center text-base font-bold ${value > 0 ? 'text-aregie-deep' : 'text-gray-400'}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-aregie-deep transition hover:bg-aregie-deep/10 active:scale-95"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

export function VentePage() {
  const { auth } = useAuth()
  const { showToast } = useToast()
  const sellableServices = auth.services.filter(
    (s) => s.serviceType === 'billetterie' && (auth.role === 'admin' || s.permissions?.canSell)
  )

  const [serviceId, setServiceId] = useState<number | null>(sellableServices[0]?.id ?? null)
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [email, setEmail] = useState('')
  const [visitDate, setVisitDate] = useState(todayIso())
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null)
  const [tariffsFailed, setTariffsFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  const showTariffsLoading = useDelayedLoading(tariffs === null)

  useEffect(() => {
    if (serviceId === null) return
    setTariffs(null)
    setQuantities({})
    setTariffsFailed(false)

    apiCall<{ data: Tariff[] }>('GET', `/billetterie/tariffs?orgId=${auth.orgId}&serviceId=${serviceId}`).then(
      (result) => {
        if (result.ok) {
          setTariffs(result.data.data)
          setQuantities(Object.fromEntries(result.data.data.map((t) => [t.tariffType, 0])))
        } else {
          setTariffsFailed(true)
        }
      }
    )
  }, [auth.orgId, serviceId, reloadKey])

  const totalCents =
    tariffs?.reduce((sum, t) => sum + t.priceCents * (quantities[t.tariffType] ?? 0), 0) ?? 0
  const qtyTotal = Object.values(quantities).reduce((a, b) => a + b, 0)
  const isFree = qtyTotal > 0 && totalCents === 0

  useEffect(() => {
    if (isFree) {
      setPaymentMethod('free')
    } else if (paymentMethod === 'free') {
      setPaymentMethod('cash')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFree])

  function resetForm() {
    setEmail('')
    setVisitDate(todayIso())
    setPaymentMethod('cash')
    setSaleResult(null)
    setResendMessage(null)
    setQuantities(Object.fromEntries((tariffs ?? []).map((t) => [t.tariffType, 0])))
  }

  async function handleResend() {
    if (!saleResult) return
    setResending(true)
    setResendMessage(null)

    const result = await apiCall(
      'POST',
      `/billetterie/orders/${saleResult.orderId}/resend-confirmation`,
      { token: auth.token }
    )

    setResending(false)
    setResendMessage(result.ok ? 'Email renvoyé.' : "Échec de l'envoi.")
  }

  async function handlePrint() {
    if (!saleResult) return
    setPrinting(true)

    const res = await fetch(
      `${GATEWAY_URL}/billetterie/orders/${saleResult.orderId}/agent-tickets-pdf`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )

    setPrinting(false)

    if (!res.ok) {
      setResendMessage('Échec du chargement du PDF.')
      return
    }

    const blob = await res.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (serviceId === null || qtyTotal === 0) return

    setSubmitting(true)
    setError(null)

    const result = await apiCall<{
      data: { orderId: number; paymentReference: string | null; tickets: SoldTicket[] }
    }>('POST', '/billetterie/orders/agent-sale', {
      token: auth.token,
      body: {
        serviceId,
        email,
        visitDate,
        paymentMethod,
        tickets: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([tariffType, quantity]) => ({ tariffType, quantity })),
      },
    })

    setSubmitting(false)

    if (result.ok) {
      setSaleResult({
        orderId: result.data.data.orderId,
        paymentReference: result.data.data.paymentReference,
        email,
        visitDate,
        paymentMethod,
        tickets: result.data.data.tickets,
      })
      showToast(
        'success',
        'Vente enregistrée',
        isFree
          ? `${qtyTotal} billet${qtyTotal > 1 ? 's' : ''} gratuit${qtyTotal > 1 ? 's' : ''}`
          : `${qtyTotal} billet${qtyTotal > 1 ? 's' : ''} · ${euros(totalCents)} encaissés en ${(PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod).toLowerCase()}`
      )
    } else {
      const errorCode = (result.data as { error?: string } | null)?.error
      const message =
        result.status === 422 && errorCode === 'visit_date_closed'
          ? "Ce jour n'est pas ouvert à la visite — choisissez une autre date."
          : result.status === 422
            ? 'Type de tarif inconnu.'
            : result.status === 403
              ? "Vous n'avez pas le droit de vendre sur ce service."
              : result.status === 409
                ? 'Ce service est fermé — impossible de vendre des billets pour le moment.'
                : 'Échec de la vente.'
      setError(message)
      showToast('error', 'Échec de la vente', message)
    }
  }

  if (sellableServices.length === 0) {
    return (
      // OrgSpace ne borne plus la largeur des pages (voir OrgSpace.tsx) —
      // Vente reste volontairement étroite : formulaire vertical façon
      // caisse, pas une liste/tableau qui profiterait de plus d'espace.
      <div className="mx-auto max-w-2xl">
        <PageHeader icon={<ShoppingCart size={20} />} title="Vente" subtitle={auth.orgName} />
        <p className="text-sm text-gray-500">Aucun service où vous pouvez vendre des billets.</p>
      </div>
    )
  }

  if (saleResult) {
    const byType = new Map<string, number>()
    for (const t of saleResult.tickets) {
      byType.set(t.tariffType, (byType.get(t.tariffType) ?? 0) + 1)
    }
    const saleTotalCents = saleResult.tickets.reduce((sum, t) => {
      const tariff = tariffs?.find((x) => x.tariffType === t.tariffType)
      return sum + (tariff?.priceCents ?? 0)
    }, 0)
    const paymentLabel = PAYMENT_METHOD_LABELS[saleResult.paymentMethod] ?? saleResult.paymentMethod

    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader icon={<ShoppingCart size={20} />} title="Vente" subtitle={auth.orgName} />

        <Card className="mb-4">
          <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
            <CheckCircle2 size={28} className="shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-gray-900">
                {saleResult.tickets.length} billet{saleResult.tickets.length > 1 ? 's' : ''} vendu
                {saleResult.tickets.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-500">Vente enregistrée avec succès</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {saleResult.paymentReference && (
              <div className="flex justify-between">
                <span className="text-gray-500">N° de commande</span>
                <span className="font-mono font-semibold tracking-tight text-gray-900">
                  {saleResult.paymentReference}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Client</span>
              <span className="font-medium text-gray-900">{saleResult.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Visite</span>
              <span className="font-medium text-gray-900">{saleResult.visitDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Billets</span>
              <span className="font-medium text-gray-900 capitalize">
                {[...byType.entries()].map(([type, count]) => `${count} × ${type}`).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paiement</span>
              <span className="font-medium text-gray-900">{paymentLabel}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                {euros(saleTotalCents)}
              </span>
            </div>
          </div>
        </Card>

        {resendMessage && <p className="mb-3 text-center text-sm text-gray-500">{resendMessage}</p>}

        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton type="button" onClick={handlePrint} disabled={printing}>
            <Printer size={16} />
            {printing ? 'Ouverture…' : 'Imprimer'}
          </SecondaryButton>
          <SecondaryButton type="button" onClick={handleResend} disabled={resending}>
            <Send size={16} />
            {resending ? 'Envoi…' : "Renvoyer l'email"}
          </SecondaryButton>
        </div>

        <PrimaryButton type="button" onClick={resetForm} className="mt-2 w-full py-3">
          <Plus size={16} />
          Nouvelle vente
        </PrimaryButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={<ShoppingCart size={20} />} title="Vente" subtitle={auth.orgName} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          {sellableServices.length > 1 ? (
            <>
              <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">Service</p>
              <SelectInput
                value={serviceId ?? ''}
                onChange={(e) => setServiceId(Number(e.target.value))}
                className="mb-4"
              >
                {sellableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectInput>
            </>
          ) : (
            <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Billets — {sellableServices[0].name}
            </p>
          )}

          {tariffsFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
          {!tariffsFailed && showTariffsLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-3">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          )}
          {!tariffsFailed && !showTariffsLoading && tariffs?.length === 0 && (
            <p className="text-sm text-gray-500">Aucun tarif actif.</p>
          )}

          <div className="space-y-2">
            {!showTariffsLoading && tariffs?.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i, 6) * 0.02 }}
                className={`flex items-center justify-between gap-2 squircle rounded-lg border px-3 py-3 transition-colors ${
                  (quantities[t.tariffType] ?? 0) > 0
                    ? 'border-aregie-deep bg-aregie-deep/[0.04]'
                    : 'border-gray-100'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 capitalize">{t.tariffType}</p>
                  <p className="text-xs text-gray-400">{euros(t.priceCents)}</p>
                </div>
                <Stepper
                  value={quantities[t.tariffType] ?? 0}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [t.tariffType]: v }))}
                />
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">Client</p>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
              <TextInput
                type="email"
                placeholder="Email du client"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">Visite</p>
            <TextInput
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              min={todayIso()}
              required
            />
          </div>
        </Card>

        <AnimatePresence mode="wait" initial={false}>
          {isFree ? (
            <motion.div
              key="free"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <Card className="flex items-center gap-3 border border-emerald-100 bg-emerald-50">
                <Gift size={20} className="shrink-0 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">
                  Gratuit — aucun encaissement nécessaire
                </p>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="payment"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <Card>
                <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">Paiement</p>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon
                    const active = paymentMethod === m.value
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 squircle rounded-xl border px-2 py-3 text-xs font-medium transition active:scale-95 ${
                          active
                            ? 'border-aregie-deep bg-aregie-deep text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={20} />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Card className="sticky bottom-4 border-aregie-deep/15 shadow-lg shadow-aregie-deep/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {qtyTotal} billet{qtyTotal > 1 ? 's' : ''}
            </p>
            <p className="text-2xl font-bold text-aregie-deep" style={{ fontFamily: 'var(--font-display)' }}>
              {isFree ? 'Gratuit' : euros(totalCents)}
            </p>
          </div>
          <PrimaryButton type="submit" disabled={submitting || qtyTotal === 0} className="w-full py-3.5 text-base">
            {submitting ? 'Enregistrement…' : isFree ? 'Valider' : 'Encaisser'}
          </PrimaryButton>
        </Card>
      </form>
    </div>
  )
}

export default VentePage
