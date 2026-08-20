import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  label,
}: {
  icon?: ReactNode
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-400">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  )
}
