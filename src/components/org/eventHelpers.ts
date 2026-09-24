import type { EventAgent } from '@/lib/types'

export type Tab = 'upcoming' | 'draft' | 'past'

export function isPastEvent(event: EventAgent): boolean {
  if (!event.eventDate) return false
  return event.eventDate < new Date().toISOString().slice(0, 10)
}

export function isLiveTab(event: EventAgent, tab: Tab): boolean {
  if (tab === 'draft') return event.status === 'draft'
  if (tab === 'past') return event.status === 'closed' || (event.status === 'published' && isPastEvent(event))
  return event.status === 'published' && !isPastEvent(event)
}

// "2026-09-27" -> "dim. 27 septembre" — pas d'année (contexte "cette
// saison"), weekday abrégé pour laisser la place au reste de la ligne.
function compactDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
}

export function eventMetaLabel(event: EventAgent): string {
  const parts = [event.eventDate ? compactDateLabel(event.eventDate) : null, event.timeLabel, event.location].filter(
    (p): p is string => Boolean(p),
  )
  return parts.length > 0 ? parts.join(' · ') : 'Date à définir'
}

export function isEventFull(event: EventAgent): boolean {
  return event.capacity !== null && event.registeredCount >= event.capacity
}

export function fillRatio(event: EventAgent): number {
  if (event.capacity === null || event.capacity === 0) return 1
  return Math.min(1, event.registeredCount / event.capacity)
}
