import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PublicShell } from '@/layouts/PublicShell'

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[11px] leading-none font-bold tracking-[0.06em] text-aregie-deep uppercase"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {children}
    </p>
  )
}

// Mentions légales + politique de confidentialité — reprises telles
// quelles du site aregiepay.aregie.com (billetterie historique), seule
// page publique qui les portait jusqu'ici. Contenu institutionnel
// (éditeur, hébergeur, RGPD), identique quel que soit le service
// (billetterie/factures/inscription) — pas de variante par organisme.
export function LegalNoticePage() {
  const navigate = useNavigate()

  return (
    <PublicShell>
      <div className="flex flex-col gap-3 pt-[14px] pb-3 md:mx-auto md:w-full md:max-w-[640px] md:pt-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="squircle flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.01_260)] text-[oklch(0.3_0.02_260)]"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>
        <div>
          <p className="text-2xl leading-[1.25] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            Mentions légales
          </p>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">Dernière mise à jour : juin 2025</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-8 md:mx-auto md:w-full md:max-w-[640px]">
        <div className="flex flex-col gap-2">
          <SectionLabel>Éditeur du site</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Ce site est édité par l'entreprise AREGIE, dont le siège est situé à Neuilly-sur-Seine (92200).
            <br />
            Directeur de la publication : AREGIE.
            <br />
            Contact : <a href="mailto:a-regie@aregie.com" className="font-semibold text-aregie-blue">a-regie@aregie.com</a>
          </p>
        </div>

        <div className="h-px bg-hairline" />

        <div className="flex flex-col gap-2">
          <SectionLabel>Hébergement</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Le site est hébergé par la société IONOS SARL, 7 place de la Gare, 57200 Sarreguemines, France.
            <br />
            Site web :{' '}
            <a href="https://www.ionos.fr" target="_blank" rel="noreferrer" className="font-semibold text-aregie-blue">
              www.ionos.fr
            </a>
          </p>
        </div>

        <div className="h-px bg-hairline" />

        <div>
          <p className="text-lg leading-[1.3] font-extrabold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            Politique de confidentialité
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Ce site, édité par AREGIE, permet la vérification d'adresse email, la réservation de billets ou
            d'inscriptions, et l'envoi d'informations par email, notamment via le service de messagerie Microsoft
            Outlook.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>1. Données personnelles collectées</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Lors de l'utilisation du site, les données suivantes peuvent être collectées : adresse e-mail, code de
            vérification à usage unique, données de réservation ou d'inscription (billets ou évènement, date,
            montant), date et heure d'accès.
          </p>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Ces données sont utilisées exclusivement pour envoyer un code de vérification par email, transmettre les
            billets ou confirmations d'inscription à l'utilisateur, assurer un suivi administratif et permettre la
            réémission des réservations si nécessaire.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>2. Base légale du traitement</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Le traitement est basé sur l'intérêt légitime d'assurer la sécurité des accès, et sur l'exécution d'un
            contrat lors de la réservation ou de l'inscription.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>3. Durée de conservation</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Les codes de vérification sont conservés quelques minutes puis supprimés automatiquement. Les données de
            réservation ou d'inscription sont conservées pendant une durée limitée (maximum 12 mois) pour répondre
            aux obligations légales et permettre la réémission des billets ou attestations.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>4. Cookies</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Ce site n'utilise aucun cookie non essentiel (publicité, tracking, analytics, etc.). Aucun consentement
            n'est requis.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>5. Partage de données</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Les données ne sont jamais vendues à des tiers. Les emails sont envoyés via les serveurs sécurisés de
            Microsoft Outlook. Les données sont hébergées en Europe chez IONOS.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>6. Droits des utilisateurs</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Conformément au RGPD, vous pouvez demander l'accès à vos données, leur rectification ou suppression, ou
            une limitation du traitement. Pour toute demande relative à vos données personnelles, contactez-nous à :{' '}
            <a href="mailto:a-regie@aregie.com" className="font-semibold text-aregie-blue">a-regie@aregie.com</a>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>7. Contact</SectionLabel>
          <p className="text-[13.5px] leading-[1.7] text-ink-soft">
            Responsable du traitement : AREGIE.
            <br />
            Email : <a href="mailto:a-regie@aregie.com" className="font-semibold text-aregie-blue">a-regie@aregie.com</a>
          </p>
        </div>
      </div>
    </PublicShell>
  )
}

export default LegalNoticePage
