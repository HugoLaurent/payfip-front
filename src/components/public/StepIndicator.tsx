// Indicateur d'étapes (maquette) — puces de 22px reliées par un trait,
// cochées pour les étapes déjà passées. Les puces restent des cercles
// (rounded-full) : un squircle n'a de sens que sur une forme dont le
// radius est petit par rapport à sa taille, pas sur un "fully rounded".
export function StepIndicator<T extends string>({
  steps,
  current,
}: {
  steps: readonly { key: T; label: string }[]
  current: T
}) {
  const currentIdx = steps.findIndex((s) => s.key === current)

  return (
    <div className="flex items-start">
      {steps.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s.key} className="contents">
            <div className="flex flex-1 flex-col items-center gap-[5px]">
              <div
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  done || active
                    ? 'bg-aregie-deep text-white'
                    : 'bg-hairline text-ink-faint'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-[9.5px] leading-none font-semibold ${
                  active
                    ? 'font-bold text-aregie-deep'
                    : done
                      ? 'text-[oklch(0.4_0.02_260)]'
                      : 'text-ink-faint'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mt-[11px] h-0.5 flex-1 rounded-full ${done ? 'bg-aregie-deep' : 'bg-hairline'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
