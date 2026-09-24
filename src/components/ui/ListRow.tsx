import { motion } from 'framer-motion'

// Ligne de liste partagée (icône/avatar + titre + sous-titre + zone de
// fin) — extraite de ServicesPage et UsersManager, qui avaient la même
// structure dupliquée. `title`/`subtitle` restent des ReactNode bruts
// (pas de typographie imposée ici) : les deux pages d'origine stylent
// leur texte différemment (police, graisse, taille), donc c'est à
// l'appelant de fournir son propre élément stylé.
export function ListRow({
  onClick,
  icon,
  iconWrapperClassName = 'h-12 w-12 rounded-xl bg-gray-100',
  title,
  subtitle,
  trailing,
  index = 0,
}: {
  onClick: () => void
  icon?: React.ReactNode
  iconWrapperClassName?: string
  title: React.ReactNode
  subtitle: React.ReactNode
  trailing?: React.ReactNode
  index?: number
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(index, 6) * 0.02 }}
      className="flex w-full items-center gap-3.5 squircle rounded-2xl bg-white p-4 text-left shadow-[0_1px_3px_rgba(20,25,60,0.06)] transition-shadow hover:shadow-md"
    >
      <div className={`flex shrink-0 items-center justify-center overflow-hidden squircle ${iconWrapperClassName}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        {title}
        {subtitle}
      </div>
      {trailing}
    </motion.button>
  )
}

export function ListRowSkeleton({
  rows = 3,
  iconWrapperClassName = 'h-12 w-12 rounded-xl',
  trailingWidth = 'w-16',
}: {
  rows?: number
  iconWrapperClassName?: string
  trailingWidth?: string | null
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex w-full items-center gap-3.5 squircle rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(20,25,60,0.06)]"
        >
          <div className={`shrink-0 animate-pulse bg-gray-100 ${iconWrapperClassName}`} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          {trailingWidth && (
            <div className={`h-5 shrink-0 animate-pulse rounded-full bg-gray-100 ${trailingWidth}`} />
          )}
        </div>
      ))}
    </>
  )
}
