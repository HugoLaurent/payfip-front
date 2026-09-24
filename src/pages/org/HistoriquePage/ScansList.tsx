import { motion } from 'framer-motion'
import { History } from 'lucide-react'
import { Card, EmptyState, LoadError, StatusBadge } from '@/components/ui'
import { SCAN_RESULT_LABELS, SCAN_RESULT_TINTS, type ScanEntry } from './types'

export function ScansList({
  scansFailed,
  showScansLoading,
  scans,
  reloadScans,
}: {
  scansFailed: boolean
  showScansLoading: boolean
  scans: ScanEntry[] | null
  reloadScans: () => void
}) {
  return (
    <div className="space-y-2">
      {scansFailed && <LoadError onRetry={reloadScans} />}
      {!scansFailed && showScansLoading &&
        Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-0 px-5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
                  <div className="h-3.5 w-16 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="mt-1.5 h-3 w-40 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-gray-100" />
            </div>
          </Card>
        ))}
      {!scansFailed && !showScansLoading && scans?.length === 0 && (
        <EmptyState icon={<History size={28} />} label="Aucun scan." />
      )}
      {!showScansLoading && scans?.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i, 6) * 0.02 }}
        >
          <Card className="p-0 px-5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={SCAN_RESULT_LABELS[s.result] ?? s.result}
                    className={SCAN_RESULT_TINTS[s.result] ?? 'bg-red-100 text-red-600'}
                  />
                  {s.tariffType && <span className="truncate text-sm text-gray-700">{s.tariffType}</span>}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-gray-400">
                  {s.agentLabel ? `Par ${s.agentLabel}` : 'Agent inconnu'}
                  {s.email && ` · ${s.email}`}
                  {s.paymentReference && ` · ${s.paymentReference}`}
                  {s.reason && ` · ${s.reason}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {new Date(s.createdAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
