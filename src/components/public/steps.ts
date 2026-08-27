// Pas d'étape "Date" : la date de visite se modifie inline sur l'écran
// Billets, ce n'est jamais un vrai écran à part — la garder comme
// première puce (toujours cochée, jamais vraiment "active") ne faisait
// que repousser Email visuellement, alors que c'est la véritable
// première étape du parcours.
export const BILLETTERIE_STEPS = [
  { key: 'email', label: 'Email' },
  { key: 'tickets', label: 'Billets' },
  { key: 'payment', label: 'Paiement' },
] as const

export type StepKey = (typeof BILLETTERIE_STEPS)[number]['key']

// Parcours facture : pas de sélection d'articles comme la billetterie —
// l'usager retrouve sa facture par référence+année+montant à la place.
export const INVOICE_STEPS = [
  { key: 'email', label: 'Email' },
  { key: 'reference', label: 'Facture' },
  { key: 'payment', label: 'Paiement' },
] as const

export type InvoiceStepKey = (typeof INVOICE_STEPS)[number]['key']

// Parcours inscription (entrée catalogue, 1a) — même châssis que la
// billetterie : Email → Inscription → Paiement. L'entrée par lien direct
// (1b) n'affiche pas ce stepper (voir PublicInscriptionDirectPage).
export const INSCRIPTION_STEPS = [
  { key: 'email', label: 'Email' },
  { key: 'inscription', label: 'Inscription' },
  { key: 'paiement', label: 'Paiement' },
] as const

export type InscriptionStepKey = (typeof INSCRIPTION_STEPS)[number]['key']
