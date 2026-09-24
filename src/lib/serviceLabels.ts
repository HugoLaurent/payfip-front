import type { EventAgent } from './types'

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

export const SERVICE_STATUS_TINTS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-gray-100 text-gray-500',
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  billetterie: 'Billetterie',
  factures: 'Facture',
  inscription: 'Inscription',
}

export const ORG_STATUS_LABELS: Record<string, string> = { active: 'Actif', suspended: 'Suspendu' }

export const ORG_STATUS_TINTS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-600',
}

export const EVENT_STATUS_LABELS: Record<EventAgent['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  closed: 'Clos',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

export const EVENT_STATUS_TINTS: Record<EventAgent['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  published: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-100 text-gray-400',
  cancelled: 'bg-red-50 text-red-600',
}
