import { useContext } from 'react'
import { AuthContext } from './authContext'

// Uniquement pour l'espace organisme (authentifié) — le parcours public
// n'a pas de session, donc pas de Provider au-dessus de lui.
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
