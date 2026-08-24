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
