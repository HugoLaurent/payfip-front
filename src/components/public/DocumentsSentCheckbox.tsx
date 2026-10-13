import { useState } from 'react'
import { apiCall } from '@/lib/api'

function formatSentDate(iso: string): string {
  return (
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) +
    ', ' +
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

// Case "j'ai bien envoyé le mail avec mes pièces justificatives". Ne prouve
// rien (aucune pièce n'est reçue par PayFiP) : la déclaration est enregistrée
// côté serveur pour que l'agent sache qu'il peut relire sa messagerie, et
// remet une inscription refusée dans sa file de vérification. Cochable une
// seule fois — une fois déclarée, la case reste cochée avec la date.
export function DocumentsSentCheckbox({
  accessToken,
  orgId,
  sentAt,
  canDeclare,
  onDeclared,
  plural = true,
}: {
  accessToken: string
  orgId: number
  sentAt: string | null
  canDeclare: boolean
  onDeclared: () => void
  plural?: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!sentAt && !canDeclare) return null

  const checked = sentAt !== null

  async function handleChange() {
    if (checked || submitting) return
    setSubmitting(true)
    setError(null)
    const result = await apiCall('POST', `/inscription/registrations/by-token/${accessToken}/documents-sent`, {
      body: { orgId },
    })
    setSubmitting(false)
    if (result.ok) onDeclared()
    else setError("Échec de l'enregistrement — réessayez.")
  }

  return (
    <div className="squircle rounded-[16px] border-[1.5px] border-hairline px-4 py-[14px] text-left md:rounded-[22px] md:px-5">
      <label className={`flex items-start gap-3 ${checked ? 'cursor-default' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={checked || submitting}
          onChange={handleChange}
          className="mt-[2px] h-[18px] w-[18px] shrink-0 accent-[var(--color-aregie-coral)]"
        />
        <span className="text-[13.5px] leading-[1.5] font-semibold text-ink">
          {plural
            ? "J'ai bien envoyé le mail avec mes pièces justificatives"
            : "J'ai bien envoyé le mail avec ma pièce justificative"}
        </span>
      </label>
      {checked && sentAt && (
        <p className="pt-[6px] pl-[30px] text-[12px] leading-[1.5] text-ink-soft">
          Déclaré le {formatSentDate(sentAt)} — l'agent est prévenu et contrôle vos pièces.
        </p>
      )}
      {!checked && (
        <p className="pt-[6px] pl-[30px] text-[12px] leading-[1.5] text-ink-soft">
          Cochez une fois votre email envoyé : l'agent saura qu'il peut le consulter.
        </p>
      )}
      {error && <p className="pt-[6px] pl-[30px] text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
