import type { useAuth } from '@/lib/useAuth'
import type { OrderScanResult, OrderScanTicket } from './OrderScanPanel'
import type { useQrScanner } from './useQrScanner'
import type { ScanHistoryEntry } from './HistorySheet'

// L'écran plein écran affiché en résultat n'a que trois couleurs — vert
// (valide), ambre (déjà scanné, pas une fraude, l'agent tranche) et
// rouge (refusé, un seul écran quel que soit le motif technique) — voir
// Scanner Terrain.dc.html.
export type ScreenResult =
  | { kind: 'valid'; tariffType: string; visitLabel: string; ticketRef: string | null }
  | {
      kind: 'already'
      ticketId: number
      tariffType: string
      visitLabel: string
      consumedLabel: string | null
    }
  | { kind: 'refused'; title: string; subtitle: string | null }

// Props partagées entre MobileScanner et DesktopScanner — un seul état
// (dans ScannerPage) et deux habillages, voir index.tsx.
export interface SharedProps {
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
