export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

export interface ServiceSummary {
  id: number
  name: string
  serviceType: string
  numcli: string | null
  permissions?: AgentPermissions
}

export interface ServiceClosure {
  id: number
  label: string
  startDate: string
  endDate: string
}

export interface ServiceRow {
  id: number
  orgId: number
  name: string
  serviceType: string
  status: string
  numcli: string | null
  slug: string | null
  hasLogo: boolean
  hasCoverImage: boolean
  openingDays: number[] | null
  openingStartTime: string | null
  openingEndTime: string | null
  closedMessage: string | null
  // Présents seulement sur la fiche détaillée (GET/PATCH /services/:id),
  // pas sur la liste — pas besoin d'afficher "ouvert/fermé" ligne par
  // ligne dans ServicesPage.
  closures?: ServiceClosure[]
  isOpen?: boolean
  reopensAt?: string | null
  closedReason?: string | null
}

export interface PageMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

export interface AuthState {
  token: string
  userId: number
  orgId: number
  orgName: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  services: ServiceSummary[]
  passwordChangeRequired: boolean
}

export interface StaffOrganization {
  id: number
  name: string
  domain: string
  status: string
  suspendedAt: string | null
  suspendedMessage: string | null
}

// Les 6 types de champ que l'agent peut composer pour le formulaire
// d'inscription — voir maquette "Parcours Inscription", écran A4.
export type RegistrationFieldType =
  | 'short_text'
  | 'date'
  | 'choice'
  | 'long_text'
  | 'number'
  | 'checkbox'

export interface RegistrationFormField {
  key: string
  label: string
  type: RegistrationFieldType
  required: boolean
  helperText?: string
  // 'choice' uniquement — ≤3 options affichées en boutons, au-delà en
  // menu déroulant (voir maquette, écran B2).
  options?: string[]
}

// Une pièce nommée à déposer par le citoyen (ex. "Pièce d'identité",
// "Certificat médical") — jamais un unique champ générique qui forcerait à
// fusionner plusieurs documents en un seul fichier. `key` identifie aussi
// le champ multipart envoyé au dépôt et registration_documents.documentKey.
export interface DocumentRequirement {
  key: string
  label: string
  instructions?: string
  required: boolean
}

// Forme réelle renvoyée par GET /inscription/events (résumé),
// GET /inscription/events/:id et GET /inscription/events/by-slug/:slug
// (même forme) — pas de dateLabel/timeLabel précalculés (eventDate +
// timeLabel bruts, formatés côté front), pas de spotsTotal séparé
// (capacity, éventuellement null = illimité).
export interface Formation {
  id: number
  slug: string
  type: 'formation' | 'evenement'
  title: string
  description: string | null
  eventDate: string | null
  // "HH:mm", pour l'export calendrier uniquement — timeLabel reste la
  // source d'affichage.
  startTime: string | null
  endTime: string | null
  timeLabel: string | null
  location: string | null
  category: string | null
  registrationDeadline: string | null
  priceCents: number
  documentRequirements: DocumentRequirement[] | null
  capacity: number | null
  maxParticipantsPerRegistration: number
  formSchema: RegistrationFormField[] | null
  seatsRemaining: number | null
  isFull: boolean
}

// Forme réelle renvoyée par GET /inscription/registrations/by-token/:accessToken
export interface RegistrationCitizen {
  id: number
  status: 'waitlisted' | 'awaiting_review' | 'rejected' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'expired'
  eventId: number
  eventTitle: string
  eventDate: string | null
  firstName: string
  lastName: string
  email: string
  quantity: number
  amountCents: number
  paymentMethod: 'payfip' | 'free'
  registrationReference: string
  rejectionReason: string | null
  reviewedByLabel: string | null
  reviewedAt: string | null
  documentDeadlineAt: string | null
  keepExistingDocuments: boolean
  documentRequirements: DocumentRequirement[] | null
  waitlistPosition: number | null
  waitlistNotifiedAt: string | null
  waitlistResponseDeadline: string | null
  cancelledAt: string | null
  createdAt: string
  canCancel: boolean
  canPay: boolean
  canConfirmWaitlistOffer: boolean
  canRetryPayment: boolean
  canReplaceDocuments: boolean
  canDownloadAttestation: boolean
}

export type EventStatus = 'draft' | 'published' | 'closed' | 'archived' | 'cancelled'

// Forme agent — GET/POST/PATCH /inscription/events (gateway), tous
// statuts (pas seulement published) contrairement à Formation.
export interface EventAgent {
  id: number
  slug: string
  type: 'formation' | 'evenement'
  title: string
  description: string | null
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  timeLabel: string | null
  location: string | null
  category: string | null
  registrationDeadline: string | null
  priceCents: number
  documentRequirements: DocumentRequirement[] | null
  capacity: number | null
  maxParticipantsPerRegistration: number
  formSchema: RegistrationFormField[] | null
  status: EventStatus
  createdAt: string
  // Inscriptions en attente de vérification — voir EventsManager.tsx, seul
  // indicateur visuel côté agent qu'une action est requise.
  pendingReviewCount: number
  // Places occupées (somme des quantity en statut réservant une place +
  // offres de liste d'attente actives — voir capacity_service.ts côté
  // svc-inscription) — remplissage affiché à la place du seul nombre de
  // places, voir EventsManager.tsx.
  registeredCount: number
}

export interface RegistrationDocumentSummary {
  id: number
  documentKey: string
  filename: string
  mimeType: string
  sizeBytes: number
  isCurrent: boolean
  createdAt: string
}

// Forme agent — GET /inscription/events/:id/registrations (gateway).
export interface RegistrationAgent {
  id: number
  status: RegistrationCitizen['status']
  firstName: string
  lastName: string
  email: string
  quantity: number
  formResponses: Record<string, unknown> | null
  amountCents: number
  paymentMethod: 'payfip' | 'free'
  registrationReference: string
  rejectionReason: string | null
  documentDeadlineAt: string | null
  keepExistingDocuments: boolean
  waitlistPosition: number | null
  reviewedByLabel: string | null
  reviewedAt: string | null
  cancelledAt: string | null
  createdAt: string
  documents?: RegistrationDocumentSummary[]
}

export interface ServiceLookup {
  orgId: number
  serviceId: number
  name: string
  serviceType: string
  isOpen: boolean
  reopensAt: string | null
  closedReason: string | null
  closedMessage: string | null
  // Jours ouverts à la visite (1=lundi...7=dimanche), null = pas de
  // restriction — n'affecte jamais `isOpen`, voir PublicPurchasePage.tsx.
  openingDays: number[] | null
  // Toutes les périodes de fermeture ponctuelles (passées/en cours/
  // futures) — une période future ne bloque pas `isOpen` mais doit quand
  // même griser ses dates dans le calendrier, voir VisitDateCalendar.tsx.
  closures: { startDate: string; endDate: string }[]
}
