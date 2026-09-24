import { useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { formatDayMonth } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import type { OrderScanResult, OrderScanTicket } from './OrderScanPanel'
import { useQrScanner } from './useQrScanner'
import type { ScanHistoryEntry } from './HistorySheet'
import { MobileScanner } from './MobileScanner'
import { DesktopScanner } from './DesktopScanner'
import type { ScreenResult } from './types'

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

    try {
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

      setCode('')
      setOrderResult(null)
      setJustScannedTicketId(result.data.ticket?.id ?? null)
      setPendingGroup(group)
      setLastResult(buildScreenResult(result.data, order))
      loadHistory()
    } catch {
      // Coupure réseau pendant le scan — sans ce catch, scanningRef reste
      // verrouillé à true et bloque tout scan suivant.
      setLastResult({ kind: 'refused', title: 'Erreur réseau', subtitle: 'Vérifiez la connexion et réessayez.' })
    } finally {
      setScanning(false)
      qrScanner.scanningRef.current = false
    }
  }

  async function submitOrderCode(rawCode: string) {
    const trimmed = rawCode.trim()
    if (!trimmed || qrScanner.scanningRef.current) return
    qrScanner.scanningRef.current = true
    setScanning(true)

    try {
      const order = await fetchOrderTickets(trimmed)
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
    } catch {
      setLastResult({ kind: 'refused', title: 'Erreur réseau', subtitle: 'Vérifiez la connexion et réessayez.' })
    } finally {
      setScanning(false)
      qrScanner.scanningRef.current = false
    }
  }

  async function validateOrderTicket(ticket: OrderScanTicket) {
    setValidatingTicketId(ticket.id)
    try {
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
      loadHistory()
    } catch {
      // Coupure réseau : on laisse le billet en l'état, l'agent peut réessayer.
    } finally {
      setValidatingTicketId(null)
    }
  }

  async function validateAllOrderTickets() {
    if (!orderResult) return
    setValidatingAll(true)
    try {
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
      loadHistory()
    } catch {
      // Coupure réseau en cours de validation groupée — sans ce catch,
      // validatingAll reste verrouillé à true et bloque le bouton.
    } finally {
      setValidatingAll(false)
    }
  }

  async function handleResetTicket(ticketId: number) {
    setResetting(true)
    try {
      const result = await apiCall('POST', `/billetterie/tickets/${ticketId}/reset-scan`, {
        token: auth.token,
      })
      if (result.ok) {
        loadHistory()
        setTimeout(() => setLastResult(null), 900)
      }
    } catch {
      // Coupure réseau : on laisse l'écran "déjà scanné" affiché, l'agent réessaie.
    } finally {
      setResetting(false)
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

export default ScannerPage
