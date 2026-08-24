import { BottomSheet } from './BottomSheet'

// Champ en monospace 26 px, lisible bras tendu ; la touche entrée du
// clavier valide — le clavier lui-même est celui de l'OS (natif), pas
// redessiné (voir Scanner Terrain.dc.html, écran 06).
export function ManualEntrySheet({
  open,
  code,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}: {
  open: boolean
  code: string
  submitting: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onCancel} maxHeight="60%">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between">
          <p className="text-[19px] font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Code du billet
          </p>
          <button type="button" onClick={onCancel} className="text-sm font-bold text-aregie-deep">
            Annuler
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-500">
          Sous le QR, sur le billet papier ou l'e-mail de confirmation.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Code du billet…"
          className="h-[72px] squircle rounded-[18px] border-[2.5px] border-aregie-deep bg-[oklch(0.98_0.008_265)] px-[18px] font-mono text-[26px] font-bold tracking-wide text-gray-900 outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="h-[62px] shrink-0 squircle rounded-[18px] bg-aregie-deep text-[17px] font-extrabold text-white transition disabled:opacity-50"
        >
          {submitting ? 'Vérification…' : 'Vérifier le billet'}
        </button>
      </form>
    </BottomSheet>
  )
}

export default ManualEntrySheet
