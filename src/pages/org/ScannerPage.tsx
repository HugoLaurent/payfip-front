import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, CheckCircle2, CheckSquare, Keyboard, Loader2, ScanLine, Ticket as TicketIcon, XCircle } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Card, LoadError, PageHeader, PrimaryButton, SecondaryButton, SelectInput, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { AuthState } from '@/lib/types'

interface ScanResponse {
  result: string
  ticket?: { id: number; tariffType: string; visitDate: string }
  ticketStatus?: string
}

interface OrderScanTicket {
  id: number
  tariffType: string
  visitDate: string
  status: string
  code: string
}

interface OrderScanResult {
  orderId: number
  paymentReference: string | null
  tickets: OrderScanTicket[]
}

// Un code de commande ("ORD{id}.{sig}") se distingue d'un code de billet
// ("{id}.{sig}") par ce préfixe — la distinction se fait côté client,
// avant tout appel réseau, pour router vers le bon endpoint.
const ORDER_CODE_PATTERN = /^ORD\d+\./

const ORDER_SCAN_ERROR_LABELS: Record<string, string> = {
  invalid_signature: 'Code de commande illisible',
  order_not_found: 'Commande introuvable',
  service_not_allowed_for_agent: 'Service non assigné',
  permission_required: "Vous n'avez pas le droit de scanner ce service",
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  issued: 'À valider',
  consumed: 'Déjà validé',
  refunded: 'Remboursé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

// Panneau affiché après le scan d'un QR de commande (regroupe tous les
// billets) — utilisé à la fois en overlay caméra et sous le champ de
// saisie manuelle, d'où l'extraction pour ne pas dupliquer la logique
// des boutons "Valider"/"Valider tout".
function OrderScanPanel({
  orderResult,
  validatingAll,
  validatingTicketId,
  onValidateTicket,
  onValidateAll,
  onDismiss,
}: {
  orderResult: OrderScanResult
  validatingAll: boolean
  validatingTicketId: number | null
  onValidateTicket: (ticket: OrderScanTicket) => void
  onValidateAll: () => void
  onDismiss: () => void
}) {
  const issuedCount = orderResult.tickets.filter((t) => t.status === 'issued').length

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <div className="flex items-center gap-2">
        <TicketIcon size={18} className="shrink-0 text-aregie-deep" />
        <p className="text-sm font-semibold text-gray-900">
          Commande {orderResult.paymentReference ?? orderResult.orderId} · {orderResult.tickets.length} billet
          {orderResult.tickets.length > 1 ? 's' : ''}
        </p>
      </div>

      {issuedCount > 1 && (
        <SecondaryButton type="button" onClick={onValidateAll} disabled={validatingAll} className="w-full">
          {validatingAll ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <CheckSquare size={15} />
          )}
          {validatingAll ? 'Validation en cours…' : `Valider tout (${issuedCount})`}
        </SecondaryButton>
      )}

      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {orderResult.tickets.map((t) => {
          const consumed = t.status === 'consumed'
          const actionable = t.status === 'issued'
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 capitalize">{t.tariffType}</p>
                <p className="text-xs text-gray-400">visite le {t.visitDate}</p>
              </div>
              {actionable ? (
                <SecondaryButton
                  type="button"
                  onClick={() => onValidateTicket(t)}
                  disabled={validatingAll || validatingTicketId === t.id}
                  className="shrink-0 px-3 py-1.5 text-xs"
                >
                  {validatingTicketId === t.id ? <Loader2 size={13} className="animate-spin" /> : 'Valider'}
                </SecondaryButton>
              ) : (
                <span
                  className={`shrink-0 text-xs font-medium ${consumed ? 'text-emerald-600' : 'text-gray-400'}`}
                >
                  {TICKET_STATUS_LABELS[t.status] ?? t.status}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <PrimaryButton type="button" onClick={onDismiss} className="w-full py-3">
        <ScanLine size={16} />
        Repasser au scan
      </PrimaryButton>
    </div>
  )
}

interface ScanHistoryEntry {
  id: number
  result: string
  reason: string | null
  agentLabel: string | null
  tariffType: string | null
  createdAt: string
}

const RESULT_LABELS: Record<string, string> = {
  valid: 'Billet valide',
  invalid_signature: 'Code illisible',
  not_found: 'Billet introuvable',
  already_consumed: 'Déjà scanné',
  invalid_date: "Ce n'est pas la date de visite",
  permission_required: "Vous n'avez pas le droit de scanner ce service",
  service_not_allowed_for_agent: 'Service non assigné',
  other: 'Refusé',
  reset: 'Remis en attente de scan',
}

// Le même QR reste dans le champ de la caméra tant que l'agent ne
// l'enlève pas — un simple cooldown temporel le laisserait resoumis en
// boucle tant qu'il reste dans le cadre. On verrouille donc le code tant
// qu'il est détecté, et on ne le libère que lorsqu'il a disparu du cadre
// pendant plus de QR_ABSENCE_GRACE_MS (tolère une frame ratée sans pour
// autant considérer que le billet a été retiré).
const QR_ABSENCE_GRACE_MS = 600

export function ScannerPage({ auth }: { auth: AuthState }) {
  const scannableServices = auth.services.filter(
    (s) => s.serviceType === 'billetterie' && (auth.role === 'admin' || s.permissions?.canScan)
  )
  const [serviceId, setServiceId] = useState<number | null>(scannableServices[0]?.id ?? null)

  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<{
    ok: boolean
    resultCode: string
    label: string
    detail: string | null
    ticketId: number | null
  } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const [orderResult, setOrderResult] = useState<OrderScanResult | null>(null)
  const [validatingAll, setValidatingAll] = useState(false)
  const [validatingTicketId, setValidatingTicketId] = useState<number | null>(null)

  const [history, setHistory] = useState<ScanHistoryEntry[] | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showHistoryLoading = useDelayedLoading(history === null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScannedRef = useRef<string | null>(null)
  const qrAbsentSinceRef = useRef<number | null>(null)
  const scanningRef = useRef(false)
  const resultShownRef = useRef(false)

  async function loadHistory() {
    if (serviceId === null) return
    setHistoryFailed(false)
    const result = await apiCall<{ data: ScanHistoryEntry[] }>(
      'GET',
      `/billetterie/scans?serviceId=${serviceId}&perPage=10&mine=true`,
      { token: auth.token }
    )
    if (result.ok) setHistory(result.data.data)
    else setHistoryFailed(true)
  }

  useEffect(() => {
    setHistory(null)
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, reloadKey])

  useEffect(() => {
    resultShownRef.current = lastResult !== null || orderResult !== null
  }, [lastResult, orderResult])

  // Point d'entrée unique (caméra + saisie manuelle) : un code de commande
  // ("ORD...") et un code de billet ne mènent pas au même endpoint, la
  // distinction se fait ici avant tout appel réseau.
  async function handleScannedCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed) return
    if (ORDER_CODE_PATTERN.test(trimmed)) {
      await submitOrderCode(trimmed)
    } else {
      await submitCode(trimmed)
    }
  }

  async function submitCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed || scanningRef.current) return
    scanningRef.current = true
    setScanning(true)

    const result = await apiCall<ScanResponse>('POST', '/billetterie/tickets/scan', {
      token: auth.token,
      body: { code: trimmed },
    })

    setScanning(false)
    scanningRef.current = false

    const ok = result.data.result === 'valid'
    const label = RESULT_LABELS[result.data.result] ?? result.data.result
    const detail = result.data.ticket
      ? `${result.data.ticket.tariffType} · visite le ${result.data.ticket.visitDate}`
      : null

    setOrderResult(null)
    setLastResult({
      ok,
      resultCode: result.data.result,
      label,
      detail,
      ticketId: result.data.ticket?.id ?? null,
    })
    setResetMessage(null)
    setCode('')
    loadHistory()
  }

  // QR de commande (un seul code pour tous les billets) : on récupère la
  // liste, chaque billet porte déjà son propre code signé — valider un
  // billet ici revient à rejouer exactement le même /tickets/scan que
  // pour un scan individuel, sans dupliquer la logique de consommation.
  async function submitOrderCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed || scanningRef.current) return
    scanningRef.current = true
    setScanning(true)

    const result = await apiCall<{ data: OrderScanResult } | { error: string }>(
      'POST',
      '/billetterie/orders/scan',
      { token: auth.token, body: { code: trimmed } }
    )

    setScanning(false)
    scanningRef.current = false
    setCode('')

    if (result.ok && 'data' in result.data) {
      setLastResult(null)
      setOrderResult(result.data.data)
    } else {
      const errorCode = 'error' in result.data ? result.data.error : 'other'
      setOrderResult(null)
      setLastResult({
        ok: false,
        resultCode: errorCode,
        label: ORDER_SCAN_ERROR_LABELS[errorCode] ?? 'Code de commande invalide',
        detail: null,
        ticketId: null,
      })
    }
  }

  async function validateOrderTicket(ticket: OrderScanTicket) {
    setValidatingTicketId(ticket.id)
    const result = await apiCall<ScanResponse>('POST', '/billetterie/tickets/scan', {
      token: auth.token,
      body: { code: ticket.code },
    })
    setValidatingTicketId(null)
    if (result.data.result === 'valid') {
      setOrderResult((prev) =>
        prev
          ? { ...prev, tickets: prev.tickets.map((t) => (t.id === ticket.id ? { ...t, status: 'consumed' } : t)) }
          : prev
      )
    }
    loadHistory()
  }

  async function validateAllOrderTickets() {
    if (!orderResult) return
    setValidatingAll(true)
    for (const ticket of orderResult.tickets) {
      if (ticket.status !== 'issued') continue
      const result = await apiCall<ScanResponse>('POST', '/billetterie/tickets/scan', {
        token: auth.token,
        body: { code: ticket.code },
      })
      if (result.data.result === 'valid') {
        setOrderResult((prev) =>
          prev
            ? { ...prev, tickets: prev.tickets.map((t) => (t.id === ticket.id ? { ...t, status: 'consumed' } : t)) }
            : prev
        )
      }
    }
    setValidatingAll(false)
    loadHistory()
  }

  async function handleResetTicket(ticketId: number) {
    setResetting(true)
    setResetMessage(null)
    const result = await apiCall('POST', `/billetterie/tickets/${ticketId}/reset-scan`, {
      token: auth.token,
    })
    setResetting(false)
    setResetMessage(result.ok ? 'Billet remis en attente de scan.' : 'Échec de la remise à zéro.')
    if (result.ok) loadHistory()
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    await handleScannedCode(code)
  }

  // Boucle caméra : capture une frame vidéo dans un canvas caché, tente
  // d'y décoder un QR à chaque frame. jsQR tourne entièrement côté
  // client (pas d'appel réseau tant qu'aucun QR n'est détecté).
  useEffect(() => {
    if (mode !== 'camera') return
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setCameraError(null)
        lastScannedRef.current = null
        qrAbsentSinceRef.current = null
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch {
        setCameraError(
          "Impossible d'accéder à la caméra — vérifiez les autorisations, ou basculez en saisie manuelle."
        )
      }
    }

    function tick() {
      if (cancelled) return
      const video = videoRef.current
      const canvas = canvasRef.current
      // Le résultat du dernier scan est affiché par-dessus la caméra —
      // inutile de continuer à décoder pendant ce temps, l'agent doit
      // d'abord taper "Repasser au scan".
      if (!resultShownRef.current && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const qr = jsQR(imageData.data, imageData.width, imageData.height)
          const code = qr?.data ?? null

          if (code && code === lastScannedRef.current) {
            // Même billet toujours dans le cadre : déjà soumis, on attend.
            qrAbsentSinceRef.current = null
          } else if (code) {
            if (!scanningRef.current) {
              lastScannedRef.current = code
              qrAbsentSinceRef.current = null
              handleScannedCode(code)
            }
          } else if (lastScannedRef.current) {
            if (qrAbsentSinceRef.current === null) {
              qrAbsentSinceRef.current = Date.now()
            } else if (Date.now() - qrAbsentSinceRef.current > QR_ABSENCE_GRACE_MS) {
              lastScannedRef.current = null
              qrAbsentSinceRef.current = null
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (scannableServices.length === 0) {
    return (
      <div>
        <PageHeader icon={<ScanLine size={20} />} title="Scanner" subtitle={auth.orgName} />
        <p className="text-sm text-gray-500">Aucun service accessible.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon={<ScanLine size={20} />} title="Scanner" subtitle={auth.orgName} />

      {scannableServices.length > 1 && (
        <div className="mb-4 w-48">
          <SelectInput
            value={serviceId ?? ''}
            onChange={(e) => setServiceId(Number(e.target.value))}
          >
            {scannableServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </div>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex gap-2">
          <SecondaryButton
            type="button"
            onClick={() => setMode('camera')}
            className={mode === 'camera' ? 'border-aregie-deep bg-aregie-deep text-white hover:bg-aregie-deep' : ''}
          >
            <Camera size={16} />
            Caméra
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => setMode('manual')}
            className={mode === 'manual' ? 'border-aregie-deep bg-aregie-deep text-white hover:bg-aregie-deep' : ''}
          >
            <Keyboard size={16} />
            Saisie manuelle
          </SecondaryButton>
        </div>

        {mode === 'camera' ? (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
                {cameraError}
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <p className="text-sm font-medium text-white">Vérification…</p>
              </div>
            )}
            {lastResult && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 text-center ${lastResult.ok ? 'bg-emerald-50' : 'bg-red-50'}`}
              >
                {lastResult.ok ? (
                  <CheckCircle2 size={40} className="text-emerald-600" />
                ) : (
                  <XCircle size={40} className="text-red-600" />
                )}
                <div>
                  <p className={`font-semibold ${lastResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                    {lastResult.label}
                  </p>
                  {lastResult.detail && <p className="text-sm text-gray-500">{lastResult.detail}</p>}
                </div>

                {lastResult.resultCode === 'already_consumed' && lastResult.ticketId && (
                  <div className="w-full border-t border-red-100 pt-3">
                    <p className="mb-2 text-xs text-gray-500">
                      Re-entrée du visiteur (sorti puis revenu) ? Vous pouvez remettre ce billet en
                      attente de scan.
                    </p>
                    <SecondaryButton
                      type="button"
                      onClick={() => handleResetTicket(lastResult.ticketId!)}
                      disabled={resetting}
                      className="w-full"
                    >
                      {resetting ? 'Remise en cours…' : 'Remettre en billet valide'}
                    </SecondaryButton>
                    {resetMessage && <p className="mt-2 text-xs text-gray-500">{resetMessage}</p>}
                  </div>
                )}

                <PrimaryButton type="button" onClick={() => setLastResult(null)} className="w-full py-3">
                  <ScanLine size={16} />
                  Repasser au scan
                </PrimaryButton>
              </div>
            )}
            {orderResult && (
              <div className="absolute inset-0 flex flex-col items-stretch justify-center gap-4 bg-white p-5">
                <OrderScanPanel
                  orderResult={orderResult}
                  validatingAll={validatingAll}
                  validatingTicketId={validatingTicketId}
                  onValidateTicket={validateOrderTicket}
                  onValidateAll={validateAllOrderTickets}
                  onDismiss={() => setOrderResult(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <TextInput
              autoFocus
              placeholder="Code du billet…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <PrimaryButton type="submit" disabled={scanning || !code.trim()}>
              Scanner
            </PrimaryButton>
          </form>
        )}
      </Card>

      {lastResult && mode === 'manual' && (
        <Card className={`mb-4 ${lastResult.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            {lastResult.ok ? (
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
            ) : (
              <XCircle size={24} className="shrink-0 text-red-600" />
            )}
            <div>
              <p className={`font-medium ${lastResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                {lastResult.label}
              </p>
              {lastResult.detail && <p className="text-sm text-gray-500">{lastResult.detail}</p>}
            </div>
          </div>

          {lastResult.resultCode === 'already_consumed' && lastResult.ticketId && (
            <div className="mt-3 border-t border-red-100 pt-3">
              <p className="mb-2 text-xs text-gray-500">
                Re-entrée du visiteur (sorti puis revenu) ? Vous pouvez remettre ce billet en attente
                de scan.
              </p>
              <SecondaryButton
                type="button"
                onClick={() => handleResetTicket(lastResult.ticketId!)}
                disabled={resetting}
              >
                {resetting ? 'Remise en cours…' : 'Remettre en billet valide'}
              </SecondaryButton>
              {resetMessage && <p className="mt-2 text-xs text-gray-500">{resetMessage}</p>}
            </div>
          )}
        </Card>
      )}

      {orderResult && mode === 'manual' && (
        <Card className="mb-4">
          <OrderScanPanel
            orderResult={orderResult}
            validatingAll={validatingAll}
            validatingTicketId={validatingTicketId}
            onValidateTicket={validateOrderTicket}
            onValidateAll={validateAllOrderTickets}
            onDismiss={() => setOrderResult(null)}
          />
        </Card>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Derniers scans</p>
        {historyFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
        {!historyFailed && showHistoryLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!historyFailed && history?.length === 0 && (
          <p className="text-sm text-gray-400">Aucun scan pour l'instant.</p>
        )}
        <div className="space-y-1">
          {history?.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/5"
            >
              <span className={h.result === 'valid' ? 'text-emerald-700' : 'text-gray-600'}>
                {RESULT_LABELS[h.result] ?? h.result}
                {h.tariffType && ` · ${h.tariffType}`}
              </span>
              <span className="text-gray-400">{new Date(h.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
