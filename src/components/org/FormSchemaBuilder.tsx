import { Plus, Trash2 } from 'lucide-react'
import { SelectInput, TextInput } from '@/components/ui'
import type { RegistrationFieldType, RegistrationFormField } from '@/lib/types'

const FIELD_TYPE_LABELS: Record<RegistrationFieldType, string> = {
  short_text: 'Texte court',
  long_text: 'Texte long',
  date: 'Date',
  number: 'Nombre',
  choice: 'Choix (boutons/menu)',
  checkbox: 'Case à cocher',
}

function slugifyKey(label: string, index: number): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `champ_${index + 1}`
}

// Composeur du formulaire dynamique d'un évènement — les 6 types de champ
// (voir maquette "Parcours Inscription" écran A4). La clé de chaque champ
// (utilisée pour stocker les réponses citoyennes) est dérivée du libellé,
// jamais éditée directement par l'agent — pas de concept de "clé" à lui
// exposer.
export function FormSchemaBuilder({
  fields,
  onChange,
}: {
  fields: RegistrationFormField[]
  onChange: (fields: RegistrationFormField[]) => void
}) {
  function updateField(index: number, patch: Partial<RegistrationFormField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange(next)
  }

  function addField() {
    const label = ''
    onChange([
      ...fields,
      { key: slugifyKey(label || `champ_${fields.length + 1}`, fields.length), label, type: 'short_text', required: true },
    ])
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={index} className="squircle space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <TextInput
              type="text"
              placeholder="Libellé du champ (ex: Nom du participant)"
              value={field.label}
              onChange={(e) =>
                updateField(index, { label: e.target.value, key: slugifyKey(e.target.value, index) })
              }
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeField(index)}
              className="shrink-0 text-gray-400 transition hover:text-red-600"
              aria-label="Supprimer ce champ"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <SelectInput
              value={field.type}
              onChange={(e) => updateField(index, { type: e.target.value as RegistrationFieldType })}
              className="flex-1"
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(index, { required: e.target.checked })}
              />
              Obligatoire
            </label>
          </div>
          {field.type === 'choice' && (
            <TextInput
              type="text"
              placeholder="Options séparées par des virgules (ex: Aucun, PSC1, PSE1)"
              value={field.options?.join(', ') ?? ''}
              onChange={(e) =>
                updateField(index, {
                  options: e.target.value
                    .split(',')
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        className="squircle inline-flex items-center gap-1.5 rounded-full bg-aregie-deep/10 px-4 py-2 text-xs font-bold text-aregie-deep transition hover:bg-aregie-deep/15"
      >
        <Plus size={14} />
        Ajouter un champ
      </button>
    </div>
  )
}
