import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month: month - 1, day }
}

// Lundi = 0 ... Dimanche = 6 (aligné sur WEEKDAY_LABELS), à partir du
// Date.getDay() natif (0 = dimanche).
function mondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

function isoWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

// Calendrier mensuel compact — remplace le <input type="date"> natif pour
// que l'usager VOIE directement quels jours sont fermés (jours hebdo
// configurés par l'organisme, voir OpeningScheduleManager.tsx) plutôt que
// de le découvrir après coup via un message d'erreur. Jamais de blocage
// de PAGE ici, uniquement une case non cliquable — cf. la règle du
// commit précédent (isVisitDateOpen).
export function VisitDateCalendar({
  value,
  onChange,
  openingDays,
  closures,
  minDate,
  onClose,
}: {
  value: string
  onChange: (iso: string) => void
  openingDays: number[] | null
  closures: { startDate: string; endDate: string }[]
  minDate: string
  onClose: () => void
}) {
  const selected = parseIso(value)
  const [viewYear, setViewYear] = useState(selected.year)
  const [viewMonth, setViewMonth] = useState(selected.month)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const min = parseIso(minDate)
  const isBeforeCurrentMonth = viewYear < min.year || (viewYear === min.year && viewMonth <= min.month)

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = mondayFirstIndex(firstOfMonth.getDay())
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function isDisabled(day: number): boolean {
    const iso = toIso(viewYear, viewMonth, day)
    if (iso < minDate) return true
    if (openingDays) {
      const jsDay = new Date(viewYear, viewMonth, day).getDay()
      if (!openingDays.includes(isoWeekday(jsDay))) return true
    }
    if (closures.some((c) => iso >= c.startDate && iso <= c.endDate)) return true
    return false
  }

  function goPrevMonth() {
    if (isBeforeCurrentMonth) return
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="squircle absolute top-full left-0 z-20 mt-2 w-[300px] rounded-2xl border border-hairline bg-white p-4 shadow-[0_16px_40px_-12px_rgba(20,25,60,0.25)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={isBeforeCurrentMonth}
          className="squircle flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13.5px] font-bold text-ink capitalize" style={{ fontFamily: 'var(--font-display)' }}>
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          className="squircle flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="flex h-7 items-center justify-center text-[11px] font-semibold text-ink-faint">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const iso = toIso(viewYear, viewMonth, day)
          const disabled = isDisabled(day)
          const isSelected = iso === value
          const isToday = iso === minDate

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(iso)
                onClose()
              }}
              className={`squircle flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-semibold transition ${
                isSelected
                  ? 'bg-aregie-blue text-white'
                  : disabled
                    ? 'cursor-not-allowed text-ink-faint/50'
                    : isToday
                      ? 'border border-aregie-blue text-aregie-blue'
                      : 'text-ink hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {(openingDays || closures.length > 0) && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3 text-[11px] text-ink-faint">
          <span className="h-2 w-2 shrink-0 rounded-full bg-gray-200" />
          Jours grisés : fermé à la visite
        </div>
      )}
    </motion.div>
  )
}
