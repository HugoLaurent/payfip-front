import { createContext } from 'react'

export interface StaffAuthContextValue {
  staffToken: string
  email: string
  name: string | null
  onLogout: () => void
}

export const StaffAuthContext = createContext<StaffAuthContextValue | null>(null)
