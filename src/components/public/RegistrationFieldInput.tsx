import { ChevronDown } from 'lucide-react'
import type { RegistrationFormField } from '@/lib/types'

export type FieldValue = string | number | boolean

const FIELD_BOX =
  'squircle flex h-[50px] w-full items-center rounded-[14px] border-[1.5px] border-hairline px-[15px] text-[14.5px] font-medium text-ink outline-none transition focus:border-aregie-blue'

// Un champ est "rempli" au sens de la validation du formulaire — voir
// maquette écran A4 : chaque champ obligatoire doit avoir une valeur
// avant l'envoi, jamais vérifié via un simple astérisque.
export function isFieldFilled(field: RegistrationFormField, value: FieldValue | undefined): boolean {
  if (!field.required) return true
  switch (field.type) {
    case 'checkbox':
      return value === true
    case 'number':
      return typeof value === 'number' && value > 0
    default:
      return typeof value === 'string' && value.trim() !== ''
  }
}

function FieldLabel({ field }: { field: RegistrationFormField }) {
  return (
    <div className="mb-[7px] flex items-baseline gap-1.5">
      <span className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">
        {field.label}
      </span>
      <span
        className={`text-[10.5px] leading-none font-medium ${field.required ? 'text-aregie-coral' : 'text-ink-faint'}`}
      >
        {field.required ? 'obligatoire' : 'facultatif'}
      </span>
    </div>
  )
}

// Rend l'un des 6 types de champ que l'agent peut composer pour le
// formulaire d'inscription (texte court, date, choix ≤3 options en
// boutons / au-delà en menu déroulant, texte long, nombre, case à
// cocher) — voir maquette "Parcours Inscription", écrans A4 et B2.
export function RegistrationFieldInput({
  field,
  value,
  onChange,
}: {
  field: RegistrationFormField
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
}) {
  if (field.type === 'checkbox') {
    const checked = value === true
    return (
      <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-[11px] text-left">
        <span
          className={`squircle mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[13px] font-bold text-white transition ${
            checked ? 'bg-aregie-coral' : 'border-[1.5px] border-hairline bg-white'
          }`}
        >
          {checked ? '✓' : ''}
        </span>
        <span className="text-[12.5px] leading-[1.55] font-normal text-[oklch(0.42_0.015_260)]">{field.label}</span>
      </button>
    )
  }

  return (
    <div>
      <FieldLabel field={field} />

      {field.type === 'short_text' && (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD_BOX}
        />
      )}

      {field.type === 'date' && (
        <div className="relative">
          <input
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD_BOX} appearance-none pr-10`}
          />
          <ChevronDown
            size={15}
            className="pointer-events-none absolute top-1/2 right-[15px] -translate-y-1/2 text-ink-faint"
          />
        </div>
      )}

      {field.type === 'long_text' && (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.helperText}
          rows={3}
          className="squircle w-full resize-none rounded-[14px] border-[1.5px] border-hairline px-[15px] py-[13px] text-[13.5px] leading-[1.5] text-ink outline-none transition placeholder:text-ink-faint focus:border-aregie-blue"
        />
      )}

      {field.type === 'choice' &&
        field.options &&
        (field.options.length <= 3 ? (
          <div className="flex gap-[7px]">
            {field.options.map((opt) => {
              const active = value === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(opt)}
                  className={`squircle flex h-[46px] flex-1 items-center justify-center rounded-[14px] text-[13px] font-semibold transition ${
                    active
                      ? 'border-2 border-aregie-coral bg-[oklch(0.98_0.012_35)] text-[oklch(0.42_0.14_35)]'
                      : 'border-[1.5px] border-hairline text-[oklch(0.42_0.02_260)]'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="relative">
            <select
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              className={`${FIELD_BOX} appearance-none pr-10`}
            >
              <option value="" disabled>
                Choisir…
              </option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute top-1/2 right-[15px] -translate-y-1/2 text-ink-faint"
            />
          </div>
        ))}

      {field.type === 'number' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, (typeof value === 'number' ? value : 0) - 1))}
            className="squircle flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-xl font-semibold text-[oklch(0.45_0.02_260)]"
          >
            −
          </button>
          <div className="squircle flex h-[50px] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-[17px] font-bold text-ink">
            {typeof value === 'number' ? value : 0}
          </div>
          <button
            type="button"
            onClick={() => onChange((typeof value === 'number' ? value : 0) + 1)}
            className="squircle flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-hairline text-xl font-semibold text-[oklch(0.45_0.02_260)]"
          >
            +
          </button>
        </div>
      )}

      {field.helperText && field.type !== 'long_text' && (
        <p className="mt-[7px] text-[11.5px] leading-[1.4] font-medium text-ink-soft">{field.helperText}</p>
      )}
    </div>
  )
}
