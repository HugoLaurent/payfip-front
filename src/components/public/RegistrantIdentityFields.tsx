const FIELD_BOX =
  'squircle flex h-[50px] w-full items-center rounded-[14px] border-[1.5px] border-hairline px-[15px] text-[14.5px] font-medium text-ink outline-none transition focus:border-aregie-blue'

// "Le participant" (prénom/nom obligatoires, côte à côte) + le nombre de
// participants — section fixe distincte du formulaire dynamique composé
// par l'agent (RegistrationFieldInput), voir maquette "Parcours
// Inscription" écrans A4 (mobile) et D2 (desktop, stepper plafonné à
// 280px — voir la classe md:w-[280px] ci-dessous).
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
      <div className="flex flex-col gap-[10px]">
        <div className="text-[11px] leading-none font-bold tracking-[0.06em] text-aregie-deep uppercase">
          Le participant
        </div>
        <div className="flex gap-[9px]">
          <div className="min-w-0 flex-1">
            <div className="mb-[7px] flex items-baseline gap-[5px]">
              <span className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
                Prénom
              </span>
              <span className="text-[10.5px] leading-none font-medium text-aregie-coral" aria-label="obligatoire">
                ·
              </span>
            </div>
            <input
              type="text"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              className={FIELD_BOX}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-[7px] flex items-baseline gap-[5px]">
              <span className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
                Nom
              </span>
              <span className="text-[10.5px] leading-none font-medium text-aregie-coral" aria-label="obligatoire">
                ·
              </span>
            </div>
            <input
              type="text"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              className={FIELD_BOX}
            />
          </div>
        </div>
      </div>

      {maxQuantity > 1 && (
        <div className="md:w-[280px]">
          <div className="mb-[7px] text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
            Nombre de participants
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="squircle flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] border-[1.5px] border-hairline text-[19px] font-semibold text-[oklch(0.45_0.02_260)]"
            >
              −
            </button>
            <div className="squircle flex h-[46px] flex-1 items-center justify-center rounded-[13px] border-[1.5px] border-hairline text-[16px] font-bold text-ink">
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
              className="squircle flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] border-[1.5px] border-hairline text-[19px] font-semibold text-[oklch(0.45_0.02_260)]"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Séparateur "Questions du service" entre l'identité du participant et le
// formulaire dynamique de l'agent — n'a de sens que s'il y a au moins un
// champ dynamique à annoncer.
export function ServiceQuestionsDivider() {
  return (
    <div className="flex items-center gap-[11px]">
      <div className="h-px flex-1 bg-[oklch(0.92_0.006_260)]" />
      <div className="text-[11px] leading-none font-bold tracking-[0.06em] text-aregie-deep uppercase">
        Questions du service
      </div>
      <div className="h-px flex-1 bg-[oklch(0.92_0.006_260)]" />
    </div>
  )
}
