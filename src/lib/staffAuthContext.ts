import { createContext } from 'react'

export interface StaffAuthContextValue {
  staffKey: string
  onLogout: () => void
}

export const StaffAuthContext = createContext<StaffAuthContextValue | null>(null)
