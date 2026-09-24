import { useEffect, useState } from 'react'

// Seuil du tiroir mobile de la Sidebar (voir OrgSpace.tsx) — même 768px
// pour que le master-detail Évènements bascule au même point que le reste
// du châssis organisme.
const QUERY = '(min-width: 768px)'

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
