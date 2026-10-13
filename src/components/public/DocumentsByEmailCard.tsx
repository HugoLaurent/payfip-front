import { useState } from 'react'
import type { DocumentRequirement } from '@/lib/types'

// Les pièces justificatives ne sont plus déposées sur PayFiP : le citoyen les
// envoie par email à l'adresse de contact de l'évènement, en citant sa
// référence d'inscription dans l'objet. Aucun fichier ne transite par nos
// serveurs. `registrationReference` est absent avant l'inscription (la
// référence n'existe pas encore) — la carte dit alors qu'elle sera donnée
// juste après.
export function DocumentsByEmailCard({
  requirements,
  contactEmail,
  registrationReference,
  heading = 'PIÈCES À ENVOYER PAR EMAIL',
}: {
  requirements: DocumentRequirement[]
  contactEmail: string
  registrationReference?: string
  heading?: string
}) {
  const [copied, setCopied] = useState(false)
  const subject = registrationReference ? `Pièces ${registrationReference}` : null

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(contactEmail)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : l'adresse reste
      // affichée et sélectionnable.
    }
  }

  return (
    <div className="squircle flex flex-col gap-[10px] rounded-[16px] bg-[oklch(0.96_0.02_265)] px-4 py-[14px] text-left md:rounded-[22px] md:px-5 md:py-4">
      <p className="text-[12.5px] leading-none font-bold tracking-[0.02em] text-[oklch(0.35_0.09_265)]">{heading}</p>

      <ul className="text-[12.5px] leading-[1.6] text-[oklch(0.42_0.05_265)]">
        {requirements.map((requirement) => (
          <li key={requirement.key}>
            · {requirement.label}
            {!requirement.required && ' (facultatif)'}
            {requirement.instructions && ` — ${requirement.instructions}`}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-[10px]">
        <div className="min-w-0">
          <p className="text-[10.5px] leading-none font-semibold tracking-[0.05em] text-ink-soft uppercase">Adresse d'envoi</p>
          <p className="pt-[6px] text-[14px] leading-none font-bold break-all text-ink select-all">{contactEmail}</p>
        </div>
        <button
          type="button"
          onClick={copyAddress}
          className="shrink-0 rounded-full border-[1.5px] border-hairline px-3 py-[6px] text-[12px] font-semibold text-ink-soft"
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>

      <p className="text-[12.5px] leading-[1.6] text-[oklch(0.42_0.05_265)]">
        {subject ? (
          <>
            Indiquez <strong className="select-all">{subject}</strong> dans l'objet de votre email pour que l'agent
            retrouve votre inscription.
          </>
        ) : (
          "Votre référence d'inscription vous sera donnée juste après, avec les consignes d'envoi par email."
        )}
      </p>
    </div>
  )
}
