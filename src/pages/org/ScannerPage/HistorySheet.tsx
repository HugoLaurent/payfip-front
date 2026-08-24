import { ScanLine } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { LoadError } from '@/components/ui'

export interface ScanHistoryEntry {
  id: number
  result: string
  reason: string | null
  agentLabel: string | null
  tariffType: string | null
  createdAt: string
}

const ENTRY_LABELS: Record<string, string> = {
  valid: 'Billet valide',
  invalid_signature: 'Code illisible',
  not_found: 'Billet introuvable',
  already_consumed: 'Déjà scanné',
  invalid_date: "Pas la date de visite",
  permission_required: "Droit refusé",
  service_not_allowed_for_agent: 'Service non assigné',
  other: 'Refusé',
  reset: 'Ré-autorisé',
}

function dotAndTint(result: string): { dot: string; bg: string; text: string } {
  if (result === 'valid') return { dot: '#03713d', bg: 'bg-[oklch(0.975_0.004_260)]', text: 'text-gray-900' }
  if (result === 'already_consumed' || result === 'reset')
    return { dot: '#8a4a05', bg: 'bg-[oklch(0.98_0.02_70)]', text: 'text-[oklch(0.28_0.04_70)]' }
  return { dot: '#9b1c17', bg: 'bg-[oklch(0.98_0.015_25)]', text: 'text-[oklch(0.3_0.05_25)]' }
}

export function HistorySheet({
  open,
  serviceName,
  entries,
  failed,
  loading,
  onClose,
  onRetry,
}: {
  open: boolean
  serviceName: string
  entries: ScanHistoryEntry[] | null
  failed: boolean
  loading: boolean
  onClose: () => void
  onRetry: () => void
}) {
  const valid = entries?.filter((e) => e.result === 'valid').length ?? 0
  const already = entries?.filter((e) => e.result === 'already_consumed').length ?? 0
  const refused = entries?.filter((e) => !['valid', 'already_consumed', 'reset'].includes(e.result)).length ?? 0

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="82%">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[20px] font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Mes derniers scans
          </p>
          <p className="text-[13px] font-medium text-gray-500">{serviceName} · aujourd'hui</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-sm font-bold text-aregie-deep">
          Fermer
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-[14px] bg-[oklch(0.965_0.02_150)] px-3.5 py-3">
          <p className="text-[22px] font-extrabold leading-none text-[#03713d]">{valid}</p>
          <p className="text-[11.5px] font-semibold text-[oklch(0.45_0.05_155)]">validés</p>
        </div>
        <div className="flex-1 rounded-[14px] bg-[oklch(0.965_0.03_70)] px-3.5 py-3">
          <p className="text-[22px] font-extrabold leading-none text-[#8a4a05]">{already}</p>
          <p className="text-[11.5px] font-semibold text-[oklch(0.48_0.06_70)]">déjà scannés</p>
        </div>
        <div className="flex-1 rounded-[14px] bg-[oklch(0.96_0.02_25)] px-3.5 py-3">
          <p className="text-[22px] font-extrabold leading-none text-[#9b1c17]">{refused}</p>
          <p className="text-[11.5px] font-semibold text-[oklch(0.48_0.06_25)]">refusés</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {failed && <LoadError onRetry={onRetry} />}
        {!failed && loading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!failed && entries?.length === 0 && <p className="text-sm text-gray-400">Aucun scan pour l'instant.</p>}
        {entries?.map((e) => {
          const { dot, bg, text } = dotAndTint(e.result)
          return (
            <div key={e.id} className={`flex items-center gap-3 rounded-[16px] ${bg} px-3.5 py-3`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[14.5px] font-bold ${text}`}>
                  {ENTRY_LABELS[e.result] ?? e.result}
                </p>
                <p className="truncate text-xs font-medium text-gray-500">{e.tariffType ?? '—'}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-gray-400">
                {new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-14 shrink-0 items-center justify-center gap-2 squircle rounded-[18px] bg-aregie-deep text-[16px] font-bold text-white"
      >
        <ScanLine size={17} />
        Reprendre le scan
      </button>
    </BottomSheet>
  )
}

export default HistorySheet
