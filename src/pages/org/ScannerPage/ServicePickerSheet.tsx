import { useState } from 'react'
import { BottomSheet } from './BottomSheet'

interface ScannableService {
  id: number
  name: string
}

// Cible de 60 px et une seule colonne : un select déroulant est
// ingérable debout — voir Scanner Terrain.dc.html, écran 08.
export function ServicePickerSheet({
  open,
  services,
  selectedId,
  countByService,
  onClose,
  onSelect,
}: {
  open: boolean
  services: ScannableService[]
  selectedId: number | null
  countByService: (serviceId: number) => number | null
  onClose: () => void
  onSelect: (serviceId: number) => void
}) {
  const [pending, setPending] = useState(selectedId)

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
          Quel service scannez-vous ?
        </p>
        <p className="text-[13px] leading-relaxed text-gray-500">
          Un billet d'un autre service sera refusé. Le choix reste actif jusqu'à ce que vous le changiez.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {services.map((s) => {
          const active = pending === s.id
          const count = countByService(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setPending(s.id)}
              className={`squircle flex items-center gap-3.5 rounded-[20px] px-4 py-4 text-left transition ${
                active ? 'bg-aregie-deep/8 ring-2 ring-aregie-deep' : 'bg-white ring-2 ring-gray-200'
              }`}
            >
              <span
                className={`h-[26px] w-[26px] shrink-0 rounded-full ${
                  active ? 'border-[7px] border-aregie-deep bg-white' : 'border-2 border-gray-300'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[17px] font-bold ${active ? 'text-gray-900' : 'text-gray-700'}`}>
                  {s.name}
                </span>
                <span className="block text-xs font-medium text-gray-500">
                  {count === null ? '—' : count === 0 ? 'Aucun scan aujourd\'hui' : `${count} validés aujourd'hui`}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={pending === null}
        onClick={() => pending !== null && onSelect(pending)}
        className="h-[60px] shrink-0 squircle rounded-[18px] bg-aregie-deep text-[17px] font-extrabold text-white transition disabled:opacity-50"
      >
        Scanner ce service
      </button>
    </BottomSheet>
  )
}

export default ServicePickerSheet
