// Pastille de statut réutilisable — un point (couleur du texte, via
// currentColor) + un libellé en gras, pour que le badge se voie davantage
// qu'un simple fond pâle sans perdre le ton doux du reste de l'espace
// organisme. `className` porte les couleurs (ex: SERVICE_STATUS_TINTS).
export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`squircle inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-4 py-1.5 text-sm font-bold ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  )
}
