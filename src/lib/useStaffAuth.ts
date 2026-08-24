import { useContext } from 'react'
import { StaffAuthContext } from './staffAuthContext'

// Uniquement pour le panel staff (clé partagée, pas de compte individuel).
export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext)
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider')
  return ctx
}
