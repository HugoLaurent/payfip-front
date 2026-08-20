import { useEffect, useState } from 'react'

/**
 * Ne passe à `true` que si `loading` reste vrai plus de `delayMs` —
 * la plupart des requêtes reviennent en quelques dizaines de ms,
 * afficher "Chargement…" immédiatement ne fait alors que clignoter à
 * l'écran sans rien apprendre à l'utilisateur.
 */
export function useDelayedLoading(loading: boolean, delayMs = 1000): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!loading) {
      setShow(false)
      return
    }
    const timeout = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(timeout)
  }, [loading, delayMs])

  return show
}
