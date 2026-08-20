import { SecondaryButton } from './Buttons'

export function Pagination({
  currentPage,
  lastPage,
  total,
  onChange,
}: {
  currentPage: number
  lastPage: number
  total: number
  onChange: (page: number) => void
}) {
  if (lastPage <= 1) return null

  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-xs text-gray-400">{total} au total</p>
      <div className="flex items-center gap-2">
        <SecondaryButton
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
          className="px-3 py-1.5"
        >
          Précédent
        </SecondaryButton>
        <p className="text-sm text-gray-500">
          {currentPage} / {lastPage}
        </p>
        <SecondaryButton
          type="button"
          disabled={currentPage >= lastPage}
          onClick={() => onChange(currentPage + 1)}
          className="px-3 py-1.5"
        >
          Suivant
        </SecondaryButton>
      </div>
    </div>
  )
}
