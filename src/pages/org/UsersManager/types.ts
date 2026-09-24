import type { AgentPermissions } from '@/lib/types'

export interface AgentServiceLink {
  id: number
  name: string
  serviceType: string
  permissions: AgentPermissions
}

export interface Agent {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  role: 'admin' | 'agent'
  lastLoginAt: string | null
  services: AgentServiceLink[]
}
