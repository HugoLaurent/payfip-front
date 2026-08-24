import type { ReactNode } from 'react'
import { StaffAuthContext, type StaffAuthContextValue } from './staffAuthContext'

export function StaffAuthProvider({
  value,
  children,
}: {
  value: StaffAuthContextValue
  children: ReactNode
}) {
  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
}
