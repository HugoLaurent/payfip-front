import type { AgentPermissions } from '@/lib/types'

export const DEFAULT_PERMISSIONS: AgentPermissions = {
  canSell: true,
  canScan: true,
  canManageTariffs: false,
  canViewHistory: true,
  canToggleService: false,
}

type PermissionKey = keyof AgentPermissions

// Ces 5 clés sont communes aux 3 types de service (même colonnes en base,
// voir user_service_assignments), mais ce qu'elles déclenchent réellement
// diffère complètement d'un type à l'autre — vérifié dans le code des
// contrôleurs de chaque service :
//  - billetterie : les 5 sont utilisées telles quelles (vente, scan,
//    tarifs, historique, ouverture/fermeture du service).
//  - inscription : canManageTariffs gère en réalité les formations/
//    évènements (créer/modifier/annuler), canScan gère les inscriptions
//    (valider/relancer/annuler), canViewHistory l'historique des
//    inscrits — canSell et canToggleService n'y sont vérifiées nulle
//    part côté backend.
//  - factures : aucune des 5 n'est vérifiée nulle part côté backend
//    (le service ne fait que recevoir un webhook AREGIE et encaisser un
//    paiement, pas d'action agent à gérer).
// Afficher les mêmes 5 cases à cocher partout (l'ancien comportement)
// montrait donc "Vendre des billets"/"Fermer les ventes" sur un service
// de facturation, sans aucun effet réel derrière la case.
export function getPermissionLabels(serviceType: string): { key: PermissionKey; label: string }[] {
  if (serviceType === 'inscription') {
    return [
      { key: 'canManageTariffs', label: 'Gérer les formations (créer, modifier, annuler)' },
      { key: 'canScan', label: 'Gérer les inscriptions (valider, relancer, annuler)' },
      { key: 'canViewHistory', label: "Voir l'historique des inscriptions" },
    ]
  }
  if (serviceType === 'factures') {
    return []
  }
  // billetterie (et tout futur type par défaut, en attendant de l'auditer)
  return [
    { key: 'canSell', label: 'Vendre des billets' },
    { key: 'canScan', label: 'Scanner les billets' },
    { key: 'canManageTariffs', label: 'Gérer les tarifs' },
    { key: 'canViewHistory', label: "Voir l'historique" },
    { key: 'canToggleService', label: 'Fermer les ventes' },
  ]
}
