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

export interface ServiceLookup {
  orgId: number
  serviceId: number
  name: string
  serviceType: string
}
