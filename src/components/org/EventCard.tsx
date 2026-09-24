import { MoreHorizontal } from 'lucide-react'
import { Card, PrimaryButton, StatusBadge } from '@/components/ui'
import { euros } from '@/lib/format'
import { EVENT_STATUS_LABELS as STATUS_LABELS, EVENT_STATUS_TINTS as STATUS_TINTS } from '@/lib/serviceLabels'
import { eventMetaLabel, fillRatio, isEventFull } from './eventHelpers'
import type { EventAgent } from '@/lib/types'

// Une rangée d'évènement dans la liste maître-détail — deux habillages
// (desktop : carte compacte cliquable pour sélectionner dans la colonne
// de détail ; mobile : rangée avec bouton "Inscrits" dédié), voir
// EventsManager.tsx.
export function EventCard({
  event,
  isPastTab,
  isDesktop,
  selected,
  canManage,
  openMenuId,
  setOpenMenuId,
  onSelect,
  onEdit,
  onArchive,
  onPublish,
  onRequestDelete,
  onRequestCancel,
}: {
  event: EventAgent
  isPastTab: boolean
  isDesktop: boolean
  selected: boolean
  canManage: boolean
  openMenuId: number | null
  setOpenMenuId: (id: number | null) => void
  onSelect: (event: EventAgent) => void
  onEdit: (event: EventAgent) => void
  onArchive: (event: EventAgent) => void
  onPublish: (event: EventAgent) => void
  onRequestDelete: (event: EventAgent) => void
  onRequestCancel: (event: EventAgent) => void
}) {
  const dimmed = event.status === 'draft' || isPastTab
  const full = isEventFull(event)
  const menuOpen = openMenuId === event.id

  const menu = menuOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
      <div className="squircle absolute top-full right-2 z-50 mt-1 w-52 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.28)]">
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Modifier l'évènement
        </button>
        <button
          type="button"
          onClick={() => onArchive(event)}
          className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Archiver
        </button>
        <div className="my-1 h-px bg-gray-100" />
        {isPastTab ? (
          <button
            type="button"
            onClick={() => {
              setOpenMenuId(null)
              onRequestDelete(event)
            }}
            className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Supprimer définitivement
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpenMenuId(null)
              onRequestCancel(event)
            }}
            className="squircle block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Annuler l'évènement
          </button>
        )}
      </div>
    </>
  )

  // Colonne desktop (340px) — rangée compacte, cliquable en entier pour
  // sélectionner l'évènement dans la colonne de détail à droite
  // (maître-détail), au lieu du bouton "Inscrits" qui ouvrait la modale.
  if (isDesktop) {
    return (
      <Card
        onClick={() => onSelect(event)}
        className={`relative flex cursor-pointer flex-col gap-1.5 p-0 px-3 py-2.5 transition ${
          selected ? 'bg-aregie-tint/5 ring-1 ring-inset ring-aregie-blue/40' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${dimmed ? 'text-gray-500' : 'text-gray-900'}`}>
            {event.title}
          </p>
          {event.pendingReviewCount > 0 && (
            <span className="squircle shrink-0 rounded-full bg-aregie-coral px-1.5 py-0.5 text-[10px] font-bold text-white">
              {event.pendingReviewCount} à vérifier
            </span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuId(menuOpen ? null : event.id)
              }}
              className="squircle -mt-1 -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={`Actions pour « ${event.title} »`}
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">{eventMetaLabel(event)}</p>
        <div className="flex items-center gap-2">
          {event.status === 'draft' ? (
            <p className="text-xs font-medium text-gray-400">Non publié</p>
          ) : (
            <>
              <div className="h-1 flex-1 rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${full ? 'bg-amber-500' : event.capacity === null ? 'bg-gray-300' : 'bg-aregie-deep'}`}
                  style={{ width: `${fillRatio(event) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-bold text-gray-700">
                {event.capacity === null ? `Illimité · ${event.registeredCount}` : `${event.registeredCount} / ${event.capacity}`}
              </span>
            </>
          )}
          <span
            className={`w-16 shrink-0 text-right text-xs font-bold ${
              !dimmed && event.priceCents === 0 ? 'text-emerald-600' : dimmed ? 'text-gray-400' : 'text-gray-900'
            }`}
          >
            {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
          </span>
        </div>
        {canManage && event.status === 'draft' && (
          <PrimaryButton
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPublish(event)
            }}
            className="mt-1 justify-center px-3 py-1.5 text-xs"
          >
            Publier
          </PrimaryButton>
        )}
        {menu}
      </Card>
    )
  }

  return (
    <Card className="relative flex flex-col gap-3 p-0 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${dimmed ? 'text-gray-500' : 'text-gray-900'}`}>{event.title}</p>
          <StatusBadge label={STATUS_LABELS[event.status]} className={STATUS_TINTS[event.status]} />
        </div>
        <p className="truncate text-xs text-gray-400">{eventMetaLabel(event)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
        <div className="w-32 shrink-0">
          {event.status === 'draft' ? (
            <p className="text-right text-xs font-medium text-gray-400">Non publié</p>
          ) : event.status === 'published' && !isPastTab ? (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-700">
                  {event.capacity === null ? `Illimité · ${event.registeredCount}` : `${event.registeredCount} / ${event.capacity}`}
                </span>
                {full && (
                  <span className="squircle rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    Complet
                  </span>
                )}
              </div>
              <div className="h-[5px] w-full rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${full ? 'bg-amber-500' : event.capacity === null ? 'bg-gray-300' : 'bg-aregie-deep'}`}
                  style={{ width: `${fillRatio(event) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-right text-xs font-semibold text-gray-400">
              {event.capacity === null ? `${event.registeredCount} inscrits` : `${event.registeredCount} / ${event.capacity}`}
            </p>
          )}
        </div>

        <p className={`w-20 shrink-0 text-right text-sm font-bold ${
          !dimmed && event.priceCents === 0 ? 'text-emerald-600' : dimmed ? 'text-gray-400' : 'text-gray-900'
        }`}>
          {event.priceCents === 0 ? 'Gratuit' : euros(event.priceCents)}
        </p>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1.5">
            {event.status === 'draft' ? (
              <PrimaryButton type="button" onClick={() => onPublish(event)} className="px-3 py-1.5 text-xs">
                Publier
              </PrimaryButton>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(event)}
                className={`squircle inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  event.pendingReviewCount > 0
                    ? 'bg-aregie-coral/10 text-aregie-coral hover:bg-aregie-coral/15'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Inscrits
                {event.pendingReviewCount > 0 && (
                  <span className="squircle flex h-4 min-w-4 items-center justify-center rounded-full bg-aregie-coral px-1 text-[10px] font-bold text-white">
                    {event.pendingReviewCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpenMenuId(menuOpen ? null : event.id)}
              className="squircle flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
              aria-label={`Actions pour « ${event.title} »`}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        )}
      </div>

      {menu}
    </Card>
  )
}
