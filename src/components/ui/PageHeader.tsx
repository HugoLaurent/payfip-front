import type { ReactNode } from 'react'

export function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aregie-deep/10 text-aregie-deep">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
