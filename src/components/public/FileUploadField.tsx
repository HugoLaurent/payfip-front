import { useRef, useState } from 'react'

// Dépôt de justificatif — dashed box tant qu'aucun fichier n'est choisi,
// puis carte pleine avec nom/poids et "Remplacer" une fois déposé (voir
// maquette "Parcours Inscription", écran A4). Pas d'upload réel : le
// back-end n'a pas encore de route de dépôt de justificatif.
export function FileUploadField({
  label = 'Justificatif de domicile',
  instructions,
  onFileChange,
}: {
  label?: string
  instructions?: string
  onFileChange?: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  function handleChange(f: File | null) {
    setFile(f)
    onFileChange?.(f)
  }

  return (
    <div>
      <div className="mb-[7px] text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
        {label}
      </div>
      {instructions && <p className="mb-[7px] text-[11.5px] leading-[1.4] text-ink-faint">{instructions}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="squircle flex w-full items-center gap-3 rounded-[14px] border-[1.5px] border-hairline px-[15px] py-[13px] text-left"
        >
          <div className="squircle flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.02_265)] text-[15px] font-bold text-aregie-deep">
            ↑
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-[1.3] font-semibold text-[oklch(0.28_0.02_260)]">
              {file.name}
            </p>
            <p className="text-[11px] leading-[1.3] font-medium text-ink-soft">
              {(file.size / (1024 * 1024)).toFixed(1)} Mo
            </p>
          </div>
          <span className="shrink-0 text-[12px] font-semibold text-aregie-blue">Remplacer</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="squircle flex w-full items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-[oklch(0.82_0.01_260)] bg-[oklch(0.985_0.004_260)] px-[15px] py-[14px] text-left"
        >
          <div className="squircle flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.02_265)] text-[15px] font-bold text-aregie-deep">
            ↑
          </div>
          <div>
            <p className="text-[13px] leading-[1.3] font-semibold text-[oklch(0.28_0.02_260)]">Déposer un fichier</p>
            <p className="text-[11px] leading-[1.3] font-medium text-ink-soft">Photo ou PDF · 10 Mo max</p>
          </div>
        </button>
      )}
    </div>
  )
}
