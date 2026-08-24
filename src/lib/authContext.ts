import { createContext } from 'react'
import type { AuthState } from './types'

export interface AuthContextValue {
  auth: AuthState
  onLogout: () => void
  onAuthUpdate: (patch: Partial<AuthState>) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
