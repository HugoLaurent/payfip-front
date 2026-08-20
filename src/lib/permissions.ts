import type { AgentPermissions, AuthState } from './types'

export function hasBilletteriePermission(
  auth: AuthState,
  permission: keyof AgentPermissions,
): boolean {
  if (auth.role === 'admin') return true
  return auth.services.some(
    (s) => s.serviceType === 'billetterie' && s.permissions?.[permission] === true,
  )
}
