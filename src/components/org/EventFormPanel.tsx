import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { PrimaryButton, SelectInput, Switch, TextInput, Textarea } from '@/components/ui'
import { FormSchemaBuilder } from './FormSchemaBuilder'
import type { EventAgent, RegistrationFormField } from '@/lib/types'

const STATUS_LABELS: Record<EventAgent['status'], string> = {
  draft: 'Brouillon',
  published: 'Publié',
  closed: 'Clos',
  archived: 'Archivé',
}

export interface EventFormState {
  type: 'formation' | 'evenement'
  title: string
  description: string
  eventDate: string
  startTime: string
  endTime: string
  timeLabel: string
  location: string
  category: string
  registrationDeadline: string
  priceCents: string
  requiresDocuments: boolean
  documentInstructions: string
  capacity: string
  maxParticipantsPerRegistration: string
  formSchema: RegistrationFormField[]
  status: EventAgent['status']
}

export const EMPTY_EVENT_FORM: EventFormState = {
  type: 'formation',
  title: '',
  description: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  timeLabel: '',
  location: '',
  category: '',
  registrationDeadline: '',
  priceCents: '0',
  requiresDocuments: false,
  documentInstructions: '',
  capacity: '',
  maxParticipantsPerRegistration: '1',
  formSchema: [],
  status: 'draft',
}

export function eventToForm(event: EventAgent): EventFormState {
  return {
    type: event.type,
    title: event.title,
    description: event.description ?? '',
    eventDate: event.eventDate ?? '',
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    timeLabel: event.timeLabel ?? '',
    location: event.location ?? '',
    category: event.category ?? '',
    registrationDeadline: event.registrationDeadline ? event.registrationDeadline.slice(0, 16) : '',
    priceCents: (event.priceCents / 100).toString(),
    requiresDocuments: event.requiresDocuments,
    documentInstructions: event.documentInstructions ?? '',
    capacity: event.capacity !== null ? String(event.capacity) : '',
    maxParticipantsPerRegistration: String(event.maxParticipantsPerRegistration),
    formSchema: event.formSchema ?? [],
    status: event.status,
  }
}

export function eventFormToPayload(form: EventFormState) {
  return {
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    eventDate: form.eventDate || undefined,
    startTime: form.startTime || undefined,
    endTime: form.endTime || undefined,
    timeLabel: form.timeLabel.trim() || undefined,
    location: form.location.trim() || undefined,
    category: form.category.trim() || undefined,
    registrationDeadline: form.registrationDeadline || undefined,
    priceCents: Math.round(Number(form.priceCents || '0') * 100),
    requiresDocuments: form.requiresDocuments,
    documentInstructions: form.documentInstructions.trim() || undefined,
    capacity: form.capacity ? Number(form.capacity) : undefined,
    maxParticipantsPerRegistration: Number(form.maxParticipantsPerRegistration || '1'),
    formSchema: form.formSchema.length > 0 ? form.formSchema : undefined,
    status: form.status,
  }
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-[7px] block text-[11.5px] font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5 border-t border-gray-100 pt-5 first:border-none first:pt-0">
      <div>
        <p
          className="text-[11px] leading-none font-bold tracking-[0.06em] text-aregie-deep uppercase"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </p>
        {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// Panneau large (pas le Modal partagé, trop étroit pour un formulaire à
// cette densité) — création/édition d'un évènement, en sections nommées
// avec des libellés toujours visibles (jamais un simple placeholder qui
// disparaît à la frappe).
export function EventFormPanel({
  editingEvent,
  form,
  onChange,
  onSubmit,
  onClose,
  saving,
  error,
}: {
  editingEvent: EventAgent | null
  form: EventFormState
  onChange: (patch: Partial<EventFormState>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
  error: string | null
}) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="squircle flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-7 py-5">
          <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            {editingEvent ? `Modifier « ${editingEvent.title} »` : 'Nouvel évènement'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <form id="event-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex flex-col gap-5">
            <Section title="Informations générales">
              <div className="flex gap-3">
                <FieldGroup label="Type">
                  <SelectInput
                    value={form.type}
                    onChange={(e) => onChange({ type: e.target.value as 'formation' | 'evenement' })}
                    className="w-[150px]"
                  >
                    <option value="formation">Formation</option>
                    <option value="evenement">Évènement</option>
                  </SelectInput>
                </FieldGroup>
                <div className="flex-1">
                  <FieldGroup label="Titre">
                    <TextInput
                      type="text"
                      placeholder="Ex. Premiers secours — PSC1"
                      value={form.title}
                      onChange={(e) => onChange({ title: e.target.value })}
                      required
                    />
                  </FieldGroup>
                </div>
              </div>
              <FieldGroup label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  placeholder="Ce que verra le citoyen sur la fiche de l'évènement"
                  rows={2}
                />
              </FieldGroup>
            </Section>

            <Section title="Date & lieu">
              <div className="flex gap-3">
                <div className="flex-1">
                  <FieldGroup label="Date">
                    <TextInput
                      type="date"
                      value={form.eventDate}
                      onChange={(e) => onChange({ eventDate: e.target.value })}
                    />
                  </FieldGroup>
                </div>
                <div className="w-[130px]">
                  <FieldGroup label="Début">
                    <TextInput
                      type="time"
                      value={form.startTime}
                      onChange={(e) => onChange({ startTime: e.target.value })}
                    />
                  </FieldGroup>
                </div>
                <div className="w-[130px]">
                  <FieldGroup label="Fin">
                    <TextInput
                      type="time"
                      value={form.endTime}
                      onChange={(e) => onChange({ endTime: e.target.value })}
                    />
                  </FieldGroup>
                </div>
              </div>
              <FieldGroup label="Libellé horaire affiché (facultatif)">
                <TextInput
                  type="text"
                  placeholder="Ex. 9h–17h — laissez vide pour utiliser Début/Fin"
                  value={form.timeLabel}
                  onChange={(e) => onChange({ timeLabel: e.target.value })}
                />
              </FieldGroup>
              <div className="flex gap-3">
                <div className="flex-1">
                  <FieldGroup label="Lieu">
                    <TextInput
                      type="text"
                      placeholder="Ex. Maison des associations"
                      value={form.location}
                      onChange={(e) => onChange({ location: e.target.value })}
                    />
                  </FieldGroup>
                </div>
                <div className="flex-1">
                  <FieldGroup label="Catégorie">
                    <TextInput
                      type="text"
                      placeholder="Ex. Sport"
                      value={form.category}
                      onChange={(e) => onChange({ category: e.target.value })}
                    />
                  </FieldGroup>
                </div>
              </div>
            </Section>

            <Section title="Inscriptions & tarif">
              <FieldGroup label="Clôture des inscriptions (facultatif)">
                <TextInput
                  type="datetime-local"
                  value={form.registrationDeadline}
                  onChange={(e) => onChange({ registrationDeadline: e.target.value })}
                  className="w-full sm:w-[280px]"
                />
              </FieldGroup>
              <div className="flex gap-3">
                <div className="flex-1">
                  <FieldGroup label="Tarif (€)">
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.priceCents}
                      onChange={(e) => onChange({ priceCents: e.target.value })}
                    />
                  </FieldGroup>
                </div>
                <div className="flex-1">
                  <FieldGroup label="Places (vide = illimité)">
                    <TextInput
                      type="number"
                      min="1"
                      placeholder="Illimité"
                      value={form.capacity}
                      onChange={(e) => onChange({ capacity: e.target.value })}
                    />
                  </FieldGroup>
                </div>
                <div className="flex-1">
                  <FieldGroup label="Participants max / inscription">
                    <TextInput
                      type="number"
                      min="1"
                      value={form.maxParticipantsPerRegistration}
                      onChange={(e) => onChange({ maxParticipantsPerRegistration: e.target.value })}
                    />
                  </FieldGroup>
                </div>
              </div>
            </Section>

            <Section title="Justificatif">
              <div className="flex items-center justify-between squircle rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Justificatif requis</p>
                  <p className="text-xs text-gray-400">L'agent devra valider le document avant confirmation.</p>
                </div>
                <Switch
                  checked={form.requiresDocuments}
                  onChange={() => onChange({ requiresDocuments: !form.requiresDocuments })}
                />
              </div>
              {form.requiresDocuments && (
                <FieldGroup label="Instructions affichées au citoyen">
                  <Textarea
                    value={form.documentInstructions}
                    onChange={(e) => onChange({ documentInstructions: e.target.value })}
                    placeholder="Ex. Justificatif de domicile de moins de 3 mois"
                    rows={2}
                  />
                </FieldGroup>
              )}
            </Section>

            <Section
              title="Formulaire citoyen"
              description="Champs supplémentaires demandés lors de l'inscription, en plus du prénom/nom déjà collectés."
            >
              <FormSchemaBuilder fields={form.formSchema} onChange={(formSchema) => onChange({ formSchema })} />
            </Section>

            <Section title="Publication">
              <FieldGroup label="Statut">
                <SelectInput
                  value={form.status}
                  onChange={(e) => onChange({ status: e.target.value as EventAgent['status'] })}
                  className="w-[200px]"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              </FieldGroup>
            </Section>
          </div>
        </form>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-7 py-5">
          {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
          <PrimaryButton type="submit" form="event-form" disabled={saving} className="px-6">
            {saving ? 'Enregistrement…' : editingEvent ? 'Enregistrer' : 'Créer'}
          </PrimaryButton>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
