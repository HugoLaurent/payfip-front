export interface OrderTicket {
  id: number
  tariffType: string
  status: string
  consumedAt: string | null
  consumedByLabel: string | null
  refundedAt: string | null
  refundedByLabel: string | null
  refundReason: string | null
}

export interface Order {
  id: number
  paymentReference: string | null
  createdAt: string
  visitDate: string
  email: string
  qtyTickets: number
  totalAmountCents: number
  status: string
  paymentMethod: string
  soldBy: string | null
  consumedCount: number
  retryCount: number
  tickets: OrderTicket[]
}

export interface ScanEntry {
  id: number
  result: string
  reason: string | null
  agentLabel: string | null
  tariffType: string | null
  email: string | null
  paymentReference: string | null
  createdAt: string
}

export const SCAN_RESULT_LABELS: Record<string, string> = {
  valid: 'Validé',
  already_consumed: 'Déjà scanné',
  invalid_date: 'Mauvaise date',
  not_found: 'Introuvable',
  invalid_signature: 'Code illisible',
  other: 'Refusé',
  reset: 'Remis en attente',
}

export const SCAN_RESULT_TINTS: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-700',
  reset: 'bg-blue-100 text-blue-700',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
}

export const STATUS_TINTS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  issued: 'Non scanné',
  refunded: 'Remboursé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

export const PER_PAGE = 10

export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
