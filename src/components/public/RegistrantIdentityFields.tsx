const FIELD_BOX =
  'squircle flex h-[50px] w-full items-center rounded-[14px] border-[1.5px] border-hairline px-[15px] text-[14.5px] font-medium text-ink outline-none transition focus:border-aregie-blue'

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <div className="mb-[7px] flex items-baseline gap-1.5">
      <span className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">{label}</span>
      <span className={`text-[10.5px] leading-none font-medium ${required ? 'text-aregie-coral' : 'text-ink-faint'}`}>
        {required ? 'obligatoire' : 'facultatif'}
      </span>
    </div>
  )
}

// Identité du participant — champs fixes distincts du formulaire
// dynamique composé par l'agent (RegistrationFieldInput) : le back exige
// firstName/lastName pour toute inscription (résumé des inscrits côté
// agent), indépendamment de ce que l'agent choisit de demander en plus.
export function RegistrantIdentityFields({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  quantity,
  maxQuantity,
  onQuantityChange,
}: {
  firstName: string
  lastName: string
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  quantity: number
  maxQuantity: number
  onQuantityChange: (value: number) => void
}) {
  return (
    <>
      <div>
        <FieldLabel label="Prénom" required />
        <input type="text" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} className={FIELD_BOX} />
      </div>
      <div>
        <FieldLabel label="Nom" required />
        <input type="text" value={lastName} onChange={(e) => onLastNameChange(e.target.value)} className={FIELD_BOX} />
      </div>
      {maxQuantity > 1 && (
        <div>
          <div className="mb-[7px] flex items-baseline gap-1.5">
            <span className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
              Nombre de participants
            </span>
            <span className="text-[10.5px] leading-none font-medium text-ink-faint">{maxQuantity} maximum par inscription</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="squircle flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-xl font-semibold text-[oklch(0.45_0.02_260)]"
            >
              −
            </button>
            <div className="squircle flex h-[50px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-[17px] font-bold text-ink">
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
              className="squircle flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-xl font-semibold text-[oklch(0.45_0.02_260)]"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  )
}
