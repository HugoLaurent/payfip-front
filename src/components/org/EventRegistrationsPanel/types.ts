import type { RegistrationAgent } from '@/lib/types'

export const STATUS_LABELS: Record<RegistrationAgent['status'], string> = {
  waitlisted: "Liste d'attente",
  awaiting_review: 'À vérifier',
  rejected: 'Rejeté',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

export const STATUS_TINTS: Record<RegistrationAgent['status'], string> = {
  waitlisted: 'bg-blue-50 text-blue-700',
  awaiting_review: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  awaiting_payment: 'bg-orange-50 text-orange-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
}

export interface PreviewingDoc {
  url: string
  mimeType: string
  filename: string
  label: string
}
