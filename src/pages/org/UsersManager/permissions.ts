import type { AgentPermissions } from '@/lib/types'

export const PERMISSION_LABELS: { key: keyof AgentPermissions; label: string }[] = [
  { key: 'canSell', label: 'Vendre des billets' },
  { key: 'canScan', label: 'Scanner les billets' },
  { key: 'canManageTariffs', label: 'Gérer les tarifs' },
  { key: 'canViewHistory', label: "Voir l'historique" },
  { key: 'canToggleService', label: 'Fermer les ventes' },
]

export const DEFAULT_PERMISSIONS: AgentPermissions = {
  canSell: true,
  canScan: true,
  canManageTariffs: false,
  canViewHistory: true,
  canToggleService: false,
}
