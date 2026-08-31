import { CreditCard, FileHeart, Home, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react'
import { TextInput } from '@/components/ui'
import type { DocumentRequirement } from '@/lib/types'

// Pièces qui reviennent souvent dans une démarche administrative — un clic
// ajoute directement le slot de dépôt nommé, l'agent ajuste le libellé ou
// les instructions ensuite plutôt que de repartir d'un champ vide à chaque
// fois. Chaque exigence est un dépôt distinct côté citoyen (voir
// FileUploadField dans le formulaire d'inscription) : jamais un unique
// champ générique qui forcerait à fusionner plusieurs documents en un PDF.
const DOCUMENT_PRESETS: { icon: typeof CreditCard; label: string; requirement: Omit<DocumentRequirement, 'key'> }[] = [
  { icon: CreditCard, label: "Carte d'identité", requirement: { label: "Carte d'identité", required: true } },
  { icon: Home, label: 'Justificatif de domicile', requirement: { label: 'Justificatif de domicile', required: true } },
  { icon: FileHeart, label: 'Certificat médical', requirement: { label: 'Certificat médical', required: true } },
  {
    icon: ShieldCheck,
    label: 'Autorisation parentale',
    requirement: { label: 'Autorisation parentale', required: true },
  },
  { icon: Wallet, label: 'RIB', requirement: { label: 'RIB', required: false } },
]

function slugifyKey(label: string, index: number): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || `document_${index + 1}`
}

function slugifyKeyForPreset(label: string): string {
  return slugifyKey(label, 0)
}

const PRESET_KEYS = new Set(DOCUMENT_PRESETS.map((p) => slugifyKeyForPreset(p.requirement.label)))

// Composeur des pièces à demander au citoyen pour un évènement — chaque
// exigence devient un slot de dépôt nommé et distinct (voir
// registrations_controller.ts#readNamedDocuments), jamais un champ
// générique "justificatif" unique qui obligerait à tout fusionner.
export function DocumentRequirementsBuilder({
  requirements,
  onChange,
}: {
  requirements: DocumentRequirement[]
  onChange: (requirements: DocumentRequirement[]) => void
}) {
  function updateRequirement(index: number, patch: Partial<DocumentRequirement>) {
    onChange(requirements.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addCustom() {
    const label = ''
    onChange([
      ...requirements,
      { key: slugifyKey(label || `document_${requirements.length + 1}`, requirements.length), label, required: true },
    ])
  }

  function togglePreset(preset: Omit<DocumentRequirement, 'key'>) {
    const key = slugifyKeyForPreset(preset.label)
    const existingIndex = requirements.findIndex((r) => r.key === key)
    if (existingIndex >= 0) onChange(requirements.filter((_, i) => i !== existingIndex))
    else onChange([...requirements, { ...preset, key }])
  }

  function removeRequirement(index: number) {
    onChange(requirements.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {requirements.map((requirement, index) =>
        PRESET_KEYS.has(requirement.key) ? null : (
          <div key={index} className="squircle space-y-2 rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <TextInput
                type="text"
                placeholder="Libellé de la pièce (ex: Justificatif de scolarité)"
                value={requirement.label}
                onChange={(e) =>
                  updateRequirement(index, { label: e.target.value, key: slugifyKey(e.target.value, index) })
                }
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeRequirement(index)}
                className="shrink-0 text-gray-400 transition hover:text-red-600"
                aria-label="Supprimer cette pièce"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <TextInput
              type="text"
              placeholder="Instructions affichées au citoyen (facultatif)"
              value={requirement.instructions ?? ''}
              onChange={(e) => updateRequirement(index, { instructions: e.target.value || undefined })}
            />
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <input
                type="checkbox"
                checked={requirement.required}
                onChange={(e) => updateRequirement(index, { required: e.target.checked })}
              />
              Obligatoire
            </label>
          </div>
        ),
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-400">Pièces courantes</p>
        <div className="flex flex-wrap gap-1.5">
          {DOCUMENT_PRESETS.map((preset) => {
            const active = requirements.some((r) => r.key === slugifyKeyForPreset(preset.requirement.label))
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => togglePreset(preset.requirement)}
                className={`squircle inline-flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-xs font-semibold transition ${
                  active
                    ? 'border-aregie-blue bg-aregie-blue text-white'
                    : 'border-gray-200 text-gray-600 hover:border-aregie-deep/30 hover:bg-aregie-deep/5 hover:text-aregie-deep'
                }`}
              >
                <preset.icon size={13} />
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="squircle inline-flex items-center gap-1.5 rounded-full bg-aregie-deep/10 px-4 py-2 text-xs font-bold text-aregie-deep transition hover:bg-aregie-deep/15"
      >
        <Plus size={14} />
        Ajouter une pièce personnalisée
      </button>
    </div>
  )
}
