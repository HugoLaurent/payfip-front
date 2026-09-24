import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react'
import type { ScreenResult } from './types'

// Icône + couleur de fond de l'écran plein écran de résultat — partagés
// entre MobileScanner (plein écran) et DesktopScanner (carte).
export function ResultIcon({ kind }: { kind: ScreenResult['kind'] }) {
  if (kind === 'valid') return <CheckCircle2 size={56} strokeWidth={2.5} />
  if (kind === 'already') return <TriangleAlert size={48} strokeWidth={2.5} />
  return <XCircle size={52} strokeWidth={2.5} />
}

export function resultBg(kind: ScreenResult['kind']): string {
  if (kind === 'valid') return '#03713d'
  if (kind === 'already') return '#8a4a05'
  return '#9b1c17'
}
