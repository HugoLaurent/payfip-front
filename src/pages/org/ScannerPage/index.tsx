import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Flashlight,
  Keyboard,
  RotateCcw,
  ScanLine,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { PageHeader } from '@/components/ui'
import { OrderScanPanel, type OrderScanResult, type OrderScanTicket } from './OrderScanPanel'
import { useQrScanner } from './useQrScanner'
import { BottomSheet } from './BottomSheet'
import { ManualEntrySheet } from './ManualEntrySheet'
import { HistorySheet, type ScanHistoryEntry } from './HistorySheet'
import { ServicePickerSheet } from './ServicePickerSheet'

interface ScanResponse {
  result: string
  reason?: string
  ticket?: { id: number; tariffType: string; visitDate: string }
  ticketStatus?: string
  orderCode?: string
  visitDate?: string
  tariffType?: string
  consumedAt?: string | null
  consumedByLabel?: string | null
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

// L'écran plein écran affiché en résultat n'a que trois couleurs — vert
// (valide), ambre (déjà scanné, pas une fraude, l'agent tranche) et
// rouge (refusé, un seul écran quel que soit le motif technique) — voir
// Scanner Terrain.dc.html.
type ScreenResult =
  | { kind: 'valid'; tariffType: string; visitLabel: string; ticketRef: string | null }
  | {
      kind: 'already'
      ticketId: number
      tariffType: string
      visitLabel: string
      consumedLabel: string | null
    }
  | { kind: 'refused'; title: string; subtitle: string | null }

function formatDayMonth(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function timeAgoFr(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  return `il y a ${Math.floor(diffMin / 60)} h`
}

function buildScreenResult(
  data: ScanResponse,
  order: { ok: true; data: OrderScanResult } | { ok: false; error: string } | null
): ScreenResult {
  if (data.result === 'valid' && data.ticket) {
    let ticketRef: string | null = null
    if (order?.ok) {
      const idx = order.data.tickets.findIndex((t) => t.id === data.ticket!.id)
      ticketRef = `${order.data.paymentReference ?? order.data.orderId} · ${idx + 1}/${order.data.tickets.length}`
    }
    return {
      kind: 'valid',
      tariffType: data.ticket.tariffType,
      visitLabel: `Aujourd'hui · ${formatDayMonth(data.ticket.visitDate)}`,
      ticketRef,
    }
  }
  if (data.result === 'already_consumed' && data.ticket) {
    return {
      kind: 'already',
      ticketId: data.ticket.id,
      tariffType: data.ticket.tariffType,
      visitLabel: formatDayMonth(data.ticket.visitDate),
      consumedLabel: data.consumedAt
        ? `Validé à ${new Date(data.consumedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${data.consumedByLabel ? ` par ${data.consumedByLabel}` : ''} — ${timeAgoFr(data.consumedAt)}`
        : null,
    }
  }
  if (data.result === 'invalid_date') {
    return {
      kind: 'refused',
      title: "Ce n'est pas la date de visite",
      subtitle: data.visitDate
        ? `Billet valable le ${formatDayMonth(data.visitDate)}${data.tariffType ? ` · ${data.tariffType}` : ''}`
        : null,
    }
  }
  if (data.result === 'invalid_signature') {
    return { kind: 'refused', title: 'Code illisible', subtitle: 'Ce QR ne correspond à aucun billet connu.' }
  }
  if (data.result === 'not_found') {
    return { kind: 'refused', title: 'Billet introuvable', subtitle: "Ce billet n'existe pas ou plus." }
  }
  if (data.reason === 'permission_required') {
    return { kind: 'refused', title: 'Accès refusé', subtitle: "Vous n'avez pas le droit de scanner ce service." }
  }
  if (data.reason === 'service_not_allowed_for_agent') {
    return { kind: 'refused', title: 'Service non assigné', subtitle: 'Ce billet appartient à un autre service.' }
  }
  return { kind: 'refused', title: 'Entrée refusée', subtitle: 'Billet non valide.' }
}

// Fixe (mobile, < 768px) et immersif comme un scanner de caisse dédié,
// vs intégré à la mise en page habituelle (>= 768px, sidebar visible) —
// même seuil que le tiroir mobile de la Sidebar (voir Sidebar.tsx), pour
// ne jamais superposer un plein écran fixe à une sidebar déjà statique.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export function ScannerPage() {
  const { auth } = useAuth()
  const scannableServices = auth.services.filter(
    (s) => s.serviceType === 'billetterie' && (auth.role === 'admin' || s.permissions?.canScan)
  )
  const [serviceId, setServiceId] = useState<number | null>(scannableServices[0]?.id ?? null)
  const currentServiceName = scannableServices.find((s) => s.id === serviceId)?.name ?? auth.orgName

  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<ScreenResult | null>(null)
  const [resetting, setResetting] = useState(false)

  const [orderResult, setOrderResult] = useState<OrderScanResult | null>(null)
  // Le billet dont le scan individuel a fait apparaître le panneau — voir
  // OrderScanPanel.tsx. Nul lors d'un scan direct du QR de commande.
  const [justScannedTicketId, setJustScannedTicketId] = useState<number | null>(null)
  // Commande à plusieurs billets détectée après un scan individuel, sans
  // ouvrir le panneau tout de suite : l'agent voit d'abord l'écran plein
  // écran de SON billet, avec un bouton pour aller voir les autres s'il
  // le souhaite — plutôt que de lui imposer directement la liste groupée.
  const [pendingGroup, setPendingGroup] = useState<OrderScanResult | null>(null)
  const [validatingAll, setValidatingAll] = useState(false)
  const [validatingTicketId, setValidatingTicketId] = useState<number | null>(null)

  const [history, setHistory] = useState<ScanHistoryEntry[] | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showHistoryLoading = useDelayedLoading(history === null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [servicePickerOpen, setServicePickerOpen] = useState(false)

  const isDesktop = useIsDesktop()

  async function loadHistory() {
    if (serviceId === null) return
    setHistoryFailed(false)
    const today = new Date().toISOString().slice(0, 10)
    const result = await apiCall<{ data: ScanHistoryEntry[] }>(
      'GET',
      `/billetterie/scans?serviceId=${serviceId}&perPage=100&mine=true&dateFrom=${today}&dateTo=${today}`,
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

  // Retour automatique au viseur après un billet valide (isolé) : le
  // panneau famille/groupe et les écrans ambre/rouge, eux, restent
  // affichés tant que l'agent n'a pas agi — voir légendes des écrans
  // 02/03/04 de la maquette. Suspendu dès qu'une commande groupée est
  // détectée (bouton "Voir les autres billets" visible) ou que le
  // panneau est déjà ouvert : l'agent doit avoir le temps de la voir.
  useEffect(() => {
    if (lastResult?.kind !== 'valid' || orderResult || pendingGroup) return
    const t = setTimeout(() => setLastResult(null), 2000)
    return () => clearTimeout(t)
  }, [lastResult, orderResult, pendingGroup])

  async function handleScannedCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed) return
    if (ORDER_CODE_PATTERN.test(trimmed)) {
      await submitOrderCode(trimmed)
    } else {
      await submitCode(trimmed)
    }
  }

  async function fetchOrderTickets(
    orderCode: string
  ): Promise<{ ok: true; data: OrderScanResult } | { ok: false; error: string }> {
    const result = await apiCall<{ data: OrderScanResult } | { error: string }>(
      'POST',
      '/billetterie/orders/scan',
      { token: auth.token, body: { code: orderCode } }
    )
    if (result.ok && 'data' in result.data) return { ok: true, data: result.data.data }
    return { ok: false, error: 'error' in result.data ? result.data.error : 'other' }
  }

  async function submitCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed || qrScanner.scanningRef.current) return
    qrScanner.scanningRef.current = true
    setScanning(true)

    const result = await apiCall<ScanResponse>('POST', '/billetterie/tickets/scan', {
      token: auth.token,
      body: { code: trimmed },
    })

    const order = result.data.orderCode ? await fetchOrderTickets(result.data.orderCode) : null
    // Le billet scanné appartient à une commande à plusieurs billets ?
    // On garde l'info de côté sans ouvrir le panneau tout de suite —
    // l'écran plein écran du billet scanné s'affiche d'abord, avec un
    // bouton pour aller voir les autres si l'agent le souhaite.
    const group = order?.ok && order.data.tickets.length > 1 ? order.data : null

    setScanning(false)
    qrScanner.scanningRef.current = false
    setCode('')

    setOrderResult(null)
    setJustScannedTicketId(result.data.ticket?.id ?? null)
    setPendingGroup(group)
    setLastResult(buildScreenResult(result.data, order))
    loadHistory()
  }

  async function submitOrderCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed || qrScanner.scanningRef.current) return
    qrScanner.scanningRef.current = true
    setScanning(true)

    const order = await fetchOrderTickets(trimmed)

    setScanning(false)
    qrScanner.scanningRef.current = false
    setCode('')

    if (order.ok) {
      setLastResult(null)
      setOrderResult(order.data)
      // Aucun billet précis n'a été individuellement scanné ici — c'est le
      // QR de la commande entière qui vient d'être présenté.
      setJustScannedTicketId(null)
      setPendingGroup(null)
    } else {
      setOrderResult(null)
      setJustScannedTicketId(null)
      setPendingGroup(null)
      setLastResult({
        kind: 'refused',
        title: ORDER_SCAN_ERROR_LABELS[order.error] ?? 'Code de commande invalide',
        subtitle: null,
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
      const consumedAt = new Date().toISOString()
      setOrderResult((prev) =>
        prev
          ? {
              ...prev,
              tickets: prev.tickets.map((t) => (t.id === ticket.id ? { ...t, status: 'consumed', consumedAt } : t)),
            }
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
        const consumedAt = new Date().toISOString()
        setOrderResult((prev) =>
          prev
            ? {
                ...prev,
                tickets: prev.tickets.map((t) => (t.id === ticket.id ? { ...t, status: 'consumed', consumedAt } : t)),
              }
            : prev
        )
      }
    }
    setValidatingAll(false)
    loadHistory()
  }

  async function handleResetTicket(ticketId: number) {
    setResetting(true)
    const result = await apiCall('POST', `/billetterie/tickets/${ticketId}/reset-scan`, {
      token: auth.token,
    })
    setResetting(false)
    if (result.ok) {
      loadHistory()
      setTimeout(() => setLastResult(null), 900)
    }
  }

  function dismissResults() {
    setLastResult(null)
    setOrderResult(null)
    setJustScannedTicketId(null)
    setPendingGroup(null)
  }

  function openGroupPanel() {
    if (pendingGroup) setOrderResult(pendingGroup)
  }

  async function handleManualSubmit() {
    await handleScannedCode(code)
  }

  const qrScanner = useQrScanner({
    active: mode === 'camera',
    paused: lastResult !== null || orderResult !== null || historyOpen || servicePickerOpen,
    onDetected: handleScannedCode,
  })

  if (scannableServices.length === 0) {
    return (
      <div>
        <PageHeader icon={<ScanLine size={20} />} title="Scanner" subtitle={currentServiceName} />
        <p className="text-sm text-gray-500">Aucun service accessible.</p>
      </div>
    )
  }

  const validToday = history?.filter((h) => h.result === 'valid').length ?? 0
  const scansToday = history?.length ?? 0

  const shared = {
    auth,
    scannableServices,
    serviceId,
    setServiceId,
    currentServiceName,
    mode,
    setMode,
    code,
    setCode,
    scanning,
    lastResult,
    resetting,
    orderResult,
    justScannedTicketId,
    pendingGroup,
    openGroupPanel,
    validatingAll,
    validatingTicketId,
    validateOrderTicket,
    validateAllOrderTickets,
    dismissResults,
    handleResetTicket,
    handleManualSubmit,
    qrScanner,
    validToday,
    scansToday,
    historyOpen,
    setHistoryOpen,
    servicePickerOpen,
    setServicePickerOpen,
    history,
    historyFailed,
    showHistoryLoading,
    setReloadKey,
  }

  return isDesktop ? <DesktopScanner {...shared} /> : <MobileScanner {...shared} />
}

// ---------------------------------------------------------------------
// Mobile — plein écran immersif : le résultat prend tout l'écran en
// couleur pleine, tout ce qui n'est pas le scan est un panneau
// escamotable, chaque action utile est dans le pouce (voir Scanner
// Terrain.dc.html, écrans 01 à 08).
// ---------------------------------------------------------------------
interface SharedProps {
  auth: ReturnType<typeof useAuth>['auth']
  scannableServices: { id: number; name: string; serviceType: string; permissions?: { canScan?: boolean } }[]
  serviceId: number | null
  setServiceId: (id: number) => void
  currentServiceName: string
  mode: 'camera' | 'manual'
  setMode: (m: 'camera' | 'manual') => void
  code: string
  setCode: (c: string) => void
  scanning: boolean
  lastResult: ScreenResult | null
  resetting: boolean
  orderResult: OrderScanResult | null
  justScannedTicketId: number | null
  pendingGroup: OrderScanResult | null
  openGroupPanel: () => void
  validatingAll: boolean
  validatingTicketId: number | null
  validateOrderTicket: (t: OrderScanTicket) => void
  validateAllOrderTickets: () => void
  dismissResults: () => void
  handleResetTicket: (id: number) => void
  handleManualSubmit: () => void
  qrScanner: ReturnType<typeof useQrScanner>
  validToday: number
  scansToday: number
  historyOpen: boolean
  setHistoryOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  servicePickerOpen: boolean
  setServicePickerOpen: (v: boolean) => void
  history: ScanHistoryEntry[] | null
  historyFailed: boolean
  showHistoryLoading: boolean
  setReloadKey: (fn: (k: number) => number) => void
}

function ResultIcon({ kind }: { kind: ScreenResult['kind'] }) {
  if (kind === 'valid') return <CheckCircle2 size={56} strokeWidth={2.5} />
  if (kind === 'already') return <TriangleAlert size={48} strokeWidth={2.5} />
  return <XCircle size={52} strokeWidth={2.5} />
}

function resultBg(kind: ScreenResult['kind']): string {
  if (kind === 'valid') return '#03713d'
  if (kind === 'already') return '#8a4a05'
  return '#9b1c17'
}

function MobileScanner(p: SharedProps) {
  const {
    scannableServices,
    serviceId,
    setServiceId,
    currentServiceName,
    mode,
    setMode,
    code,
    setCode,
    scanning,
    lastResult,
    resetting,
    orderResult,
    justScannedTicketId,
    pendingGroup,
    openGroupPanel,
    validatingAll,
    validatingTicketId,
    validateOrderTicket,
    validateAllOrderTickets,
    dismissResults,
    handleResetTicket,
    handleManualSubmit,
    qrScanner,
    validToday,
    scansToday,
    historyOpen,
    setHistoryOpen,
    servicePickerOpen,
    setServicePickerOpen,
    history,
    historyFailed,
    showHistoryLoading,
    setReloadKey,
  } = p

  return (
    <div
      className="absolute inset-0 overflow-hidden overscroll-contain bg-[#0a0d18]"
      style={{ fontFamily: 'var(--font-public)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 30%, oklch(0.35 0.02 250) 0%, oklch(0.16 0.015 260) 60%, #05070d 100%)',
        }}
      />
      {mode === 'camera' && !lastResult && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[.16]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.5) 22px 23px)',
          }}
        />
      )}

      {mode === 'camera' && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={qrScanner.videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
          <canvas ref={qrScanner.canvasRef} className="hidden" />
        </>
      )}

      {!lastResult && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => scannableServices.length > 1 && setServicePickerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[16px] border border-white/16 bg-[#0a0d18]/62 px-4 py-3 text-left backdrop-blur-md"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#3ddc84] shadow-[0_0_0_4px_rgba(61,220,132,.22)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold leading-tight text-white">
                {currentServiceName}
              </span>
              {scannableServices.length > 1 && (
                <span className="block text-[11.5px] font-medium text-white/60">
                  Service scanné · appuyer pour changer
                </span>
              )}
            </span>
            {scannableServices.length > 1 && <ChevronDown size={15} className="shrink-0 text-white/70" />}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] border border-white/16 bg-[#0a0d18]/62 text-white backdrop-blur-md"
            aria-label="Derniers scans"
          >
            <RotateCcw size={19} />
            {scansToday > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-[#0a0d18] bg-aregie-blue px-1 text-[10.5px] font-bold text-white">
                {scansToday}
              </span>
            )}
          </button>
        </div>
      )}

      {mode === 'camera' && !lastResult && !orderResult && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
          <div className="relative h-[268px] w-[268px]">
            <div className="absolute top-0 left-0 h-14 w-14 rounded-tl-[20px] border-t-[5px] border-l-[5px] border-white" />
            <div className="absolute top-0 right-0 h-14 w-14 rounded-tr-[20px] border-t-[5px] border-r-[5px] border-white" />
            <div className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-[20px] border-b-[5px] border-l-[5px] border-white" />
            <div className="absolute right-0 bottom-0 h-14 w-14 rounded-br-[20px] border-r-[5px] border-b-[5px] border-white" />
          </div>
          {!qrScanner.cameraError && !scanning && (
            <p className="max-w-[250px] text-center text-[15.5px] font-semibold text-white/90">
              Présentez le QR du billet
              <br />
              <span className="font-medium text-white/55">La validation part toute seule</span>
            </p>
          )}
          {scanning && <p className="text-[15.5px] font-semibold text-white/90">Vérification…</p>}
        </div>
      )}

      {qrScanner.cameraError && mode === 'camera' && !lastResult && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
          {qrScanner.cameraError}
        </div>
      )}

      {!lastResult && mode === 'camera' && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between px-1.5 text-[12.5px] font-semibold text-white/60">
            <span>
              <span className="font-extrabold text-[#3ddc84]">{validToday}</span> validés aujourd'hui
            </span>
            {qrScanner.torchSupported && (
              <button
                type="button"
                onClick={qrScanner.toggleTorch}
                className={`flex items-center gap-1.5 ${qrScanner.torchOn ? 'text-white' : 'text-white/60'}`}
              >
                <Flashlight size={14} />
                Torche
              </button>
            )}
          </div>
          <div className="flex gap-1.5 rounded-[20px] border border-white/14 bg-white/10 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('camera')}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[15px] bg-white text-[15.5px] font-bold text-[#131a33]"
            >
              <Camera size={17} />
              Caméra
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[15px] text-[15.5px] font-semibold text-white/82"
            >
              <Keyboard size={17} />
              Code
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {lastResult && (
          <motion.div
            key={lastResult.kind}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 flex flex-col overflow-y-auto overscroll-contain"
            style={{ background: resultBg(lastResult.kind) }}
          >
            <p className="shrink-0 pt-[max(12px,env(safe-area-inset-top))] text-center text-[12.5px] font-semibold text-white/70">
              {currentServiceName}
            </p>

            <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-4">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-[34px] bg-white"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ResultIcon kind={lastResult.kind} />
              </motion.div>

              {lastResult.kind === 'valid' && (
                <p className="shrink-0 text-center text-[32px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Entrée
                  <br />
                  autorisée
                </p>
              )}
              {lastResult.kind === 'already' && (
                <p className="shrink-0 text-center text-[30px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Déjà
                  <br />
                  scanné
                </p>
              )}
              {lastResult.kind === 'refused' && (
                <p className="shrink-0 text-center text-[32px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Entrée
                  <br />
                  refusée
                </p>
              )}

              {lastResult.kind === 'valid' && (
                <div className="flex w-full shrink-0 flex-col gap-2.5 rounded-[20px] border border-white/22 bg-white/14 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-white/72">Tarif</span>
                    <span className="text-[20px] font-extrabold text-white">{lastResult.tariffType}</span>
                  </div>
                  <div className="h-px bg-white/20" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-white/72">Visite</span>
                    <span className="text-[16px] font-bold text-white">{lastResult.visitLabel}</span>
                  </div>
                  {lastResult.ticketRef && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-white/72">Billet</span>
                      <span className="font-mono text-[14px] font-semibold text-white/90">{lastResult.ticketRef}</span>
                    </div>
                  )}
                </div>
              )}

              {lastResult.kind === 'already' && (
                <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-[18px] border border-white/22 bg-white/14 px-4 py-3.5">
                  <p className="text-[18px] font-extrabold text-white">
                    {lastResult.tariffType} · {lastResult.visitLabel}
                  </p>
                  {lastResult.consumedLabel && (
                    <p className="text-[13.5px] font-semibold text-white/82">{lastResult.consumedLabel}</p>
                  )}
                </div>
              )}

              {lastResult.kind === 'refused' && (
                <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-[20px] border border-white/22 bg-white/14 px-5 py-4">
                  <p className="text-[20px] font-extrabold text-white">{lastResult.title}</p>
                  {lastResult.subtitle && <p className="text-[14.5px] font-semibold text-white/85">{lastResult.subtitle}</p>}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {lastResult.kind === 'already' && (
                <div className="flex flex-col gap-2 rounded-[18px] bg-black/16 px-4 pt-3 pb-3.5">
                  <p className="text-[12.5px] font-medium text-white/80">
                    Le visiteur est sorti puis revenu ? Remettez le billet en attente de scan.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleResetTicket(lastResult.ticketId)}
                    disabled={resetting}
                    className="flex h-[50px] items-center justify-center gap-2 rounded-[15px] border-2 border-white/85 text-[15px] font-bold text-white disabled:opacity-70"
                  >
                    <RotateCcw size={16} />
                    {resetting ? 'Remise en cours…' : "Ré-autoriser l'entrée"}
                  </button>
                </div>
              )}
              {pendingGroup && (
                <button
                  type="button"
                  onClick={openGroupPanel}
                  className="flex h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-white/40 text-[15px] font-bold text-white"
                >
                  <Users size={16} />
                  Voir les {pendingGroup.tickets.length - 1} autres billets de la commande
                </button>
              )}
              <button
                type="button"
                onClick={dismissResults}
                className="flex h-14 items-center justify-center gap-2.5 rounded-[19px] bg-white text-[16.5px] font-extrabold"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ScanLine size={16} />
                Scanner le suivant
              </button>
              {lastResult.kind === 'valid' && !pendingGroup && (
                <p className="text-center text-[12.5px] font-medium text-white/68">Retour au viseur dans 2 s</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ManualEntrySheet
        open={mode === 'manual' && !lastResult}
        code={code}
        submitting={scanning}
        onChange={setCode}
        onSubmit={handleManualSubmit}
        onCancel={() => setMode('camera')}
      />

      <BottomSheet open={!!orderResult} onClose={dismissResults} maxHeight="88%">
        {orderResult && (
          <OrderScanPanel
            orderResult={orderResult}
            justScannedTicketId={justScannedTicketId}
            validatingAll={validatingAll}
            validatingTicketId={validatingTicketId}
            onValidateTicket={validateOrderTicket}
            onValidateAll={validateAllOrderTickets}
            onDismiss={dismissResults}
          />
        )}
      </BottomSheet>

      <HistorySheet
        open={historyOpen}
        serviceName={currentServiceName}
        entries={history}
        failed={historyFailed}
        loading={showHistoryLoading}
        onClose={() => setHistoryOpen(false)}
        onRetry={() => setReloadKey((k) => k + 1)}
      />

      <ServicePickerSheet
        open={servicePickerOpen}
        services={scannableServices}
        selectedId={serviceId}
        countByService={(id) => (id === serviceId ? validToday : null)}
        onClose={() => setServicePickerOpen(false)}
        onSelect={(id) => {
          setServiceId(id)
          setServicePickerOpen(false)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Desktop (>= 768px) — usage secondaire (guichet) : plus de largeur,
// viseur et résultat côte à côte au lieu de s'empiler (voir Scanner
// Terrain.dc.html, écran 09).
// ---------------------------------------------------------------------
function DesktopScanner(p: SharedProps) {
  const {
    scannableServices,
    serviceId,
    setServiceId,
    currentServiceName,
    code,
    setCode,
    scanning,
    lastResult,
    resetting,
    orderResult,
    justScannedTicketId,
    pendingGroup,
    openGroupPanel,
    validatingAll,
    validatingTicketId,
    validateOrderTicket,
    validateAllOrderTickets,
    dismissResults,
    handleResetTicket,
    handleManualSubmit,
    qrScanner,
    validToday,
    historyOpen,
    setHistoryOpen,
    history,
    historyFailed,
    showHistoryLoading,
    setReloadKey,
  } = p

  return (
    <div className="relative" style={{ fontFamily: 'var(--font-public)' }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          icon={<ScanLine size={20} />}
          title="Scanner"
          subtitle={`${currentServiceName} · ${validToday} validés aujourd'hui`}
        />
        <div className="flex gap-2">
          {scannableServices.length > 1 && (
            <select
              value={serviceId ?? ''}
              onChange={(e) => setServiceId(Number(e.target.value))}
              className="squircle h-10 rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700"
            >
              {scannableServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="squircle flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700"
          >
            <RotateCcw size={14} />
            Derniers scans
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="squircle relative aspect-square overflow-hidden rounded-[22px] bg-[#0a0d18]">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 30%, oklch(0.32 0.02 250) 0%, oklch(0.15 0.015 260) 60%, #05070d 100%)',
            }}
          />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={qrScanner.videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
          <canvas ref={qrScanner.canvasRef} className="hidden" />
          {!qrScanner.cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative h-[200px] w-[200px]">
                <div className="absolute top-0 left-0 h-11 w-11 rounded-tl-2xl border-t-4 border-l-4 border-white" />
                <div className="absolute top-0 right-0 h-11 w-11 rounded-tr-2xl border-t-4 border-r-4 border-white" />
                <div className="absolute bottom-0 left-0 h-11 w-11 rounded-bl-2xl border-b-4 border-l-4 border-white" />
                <div className="absolute right-0 bottom-0 h-11 w-11 rounded-br-2xl border-r-4 border-b-4 border-white" />
              </div>
              <p className="text-[13px] font-semibold text-white/80">Présentez le QR du billet</p>
            </div>
          )}
          {qrScanner.cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
              {qrScanner.cameraError}
            </div>
          )}
          {orderResult && (
            <BottomSheet open onClose={dismissResults} maxHeight="92%">
              <OrderScanPanel
                orderResult={orderResult}
                justScannedTicketId={justScannedTicketId}
                validatingAll={validatingAll}
                validatingTicketId={validatingTicketId}
                onValidateTicket={validateOrderTicket}
                onValidateAll={validateAllOrderTickets}
                onDismiss={dismissResults}
              />
            </BottomSheet>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {lastResult ? (
            <div className="squircle flex flex-col gap-3.5 rounded-[22px] p-6" style={{ background: resultBg(lastResult.kind) }}>
              <div className="flex items-center gap-3.5">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex h-14 w-14 shrink-0 items-center justify-center squircle rounded-[18px] bg-white"
                  style={{ color: resultBg(lastResult.kind) }}
                >
                  <ResultIcon kind={lastResult.kind} />
                </motion.div>
                <p className="text-[26px] leading-[1.1] font-black tracking-tight text-white uppercase">
                  {lastResult.kind === 'valid' && (
                    <>
                      Entrée
                      <br />
                      autorisée
                    </>
                  )}
                  {lastResult.kind === 'already' && (
                    <>
                      Déjà
                      <br />
                      scanné
                    </>
                  )}
                  {lastResult.kind === 'refused' && (
                    <>
                      Entrée
                      <br />
                      refusée
                    </>
                  )}
                </p>
              </div>
              <div className="h-px bg-white/22" />
              {lastResult.kind === 'valid' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">{lastResult.tariffType}</p>
                  <p className="text-[13.5px] font-semibold text-white/85">
                    {lastResult.visitLabel}
                    {lastResult.ticketRef && ` · ${lastResult.ticketRef}`}
                  </p>
                </div>
              )}
              {lastResult.kind === 'already' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">
                    {lastResult.tariffType} · {lastResult.visitLabel}
                  </p>
                  {lastResult.consumedLabel && (
                    <p className="text-[13.5px] font-semibold text-white/85">{lastResult.consumedLabel}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResetTicket(lastResult.ticketId)}
                    disabled={resetting}
                    className="mt-2 flex h-11 items-center justify-center gap-2 squircle rounded-[14px] border-2 border-white/85 text-[14px] font-bold text-white disabled:opacity-70"
                  >
                    <RotateCcw size={15} />
                    {resetting ? 'Remise en cours…' : "Ré-autoriser l'entrée"}
                  </button>
                </div>
              )}
              {lastResult.kind === 'refused' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">{lastResult.title}</p>
                  {lastResult.subtitle && <p className="text-[13.5px] font-semibold text-white/85">{lastResult.subtitle}</p>}
                </div>
              )}
              {pendingGroup && (
                <button
                  type="button"
                  onClick={openGroupPanel}
                  className="flex h-11 items-center justify-center gap-2 squircle rounded-[14px] border-2 border-white/40 text-[14px] font-bold text-white"
                >
                  <Users size={15} />
                  Voir les {pendingGroup.tickets.length - 1} autres billets de la commande
                </button>
              )}
              <button
                type="button"
                onClick={dismissResults}
                className="flex h-11 items-center justify-center gap-2 squircle rounded-[14px] bg-white text-[14px] font-bold"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ScanLine size={15} />
                Scanner le suivant
              </button>
            </div>
          ) : (
            <div className="squircle flex items-center gap-2 rounded-[22px] bg-gray-100 p-6 text-sm text-gray-400">
              En attente d'un scan…
            </div>
          )}

          <div className="squircle flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-gray-200 bg-white p-[18px]">
            <p className="text-[13.5px] font-bold text-gray-700">Saisie manuelle</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleManualSubmit()
              }}
              className="flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code du billet…"
                className="h-11 flex-1 squircle rounded-xl border-[1.5px] border-gray-200 px-3.5 font-mono text-[15px] text-gray-700 outline-none focus:border-aregie-deep"
              />
              <button
                type="submit"
                disabled={scanning || !code.trim()}
                className="h-11 shrink-0 squircle rounded-xl bg-aregie-deep px-[18px] text-[14px] font-bold text-white disabled:opacity-50"
              >
                Vérifier
              </button>
            </form>
          </div>
        </div>
      </div>

      <HistorySheet
        open={historyOpen}
        serviceName={currentServiceName}
        entries={history}
        failed={historyFailed}
        loading={showHistoryLoading}
        onClose={() => setHistoryOpen(false)}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    </div>
  )
}

export default ScannerPage
