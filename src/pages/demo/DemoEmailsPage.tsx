import { useEffect, useState } from 'react'
import { Mail, Sparkles } from 'lucide-react'
import { apiCall } from '@/lib/api'

interface CatalogEntry {
  template: string
  title: string
  description: string
}

// Un email par situation citoyenne, dans l'ordre où elles surviennent dans
// un parcours réel — les titres/descriptions sont la copie de présentation
// (pas de vocabulaire technique de template), les données de rendu
// elles-mêmes restent factices côté svc-mail (EXAMPLE_EMAIL_DATA).
const CATALOG: CatalogEntry[] = [
  {
    template: 'otp_code',
    title: 'Code de vérification',
    description: "Envoyé à chaque vérification d'adresse email, avant tout achat ou inscription.",
  },
  {
    template: 'ticket_confirmation',
    title: 'Confirmation de réservation',
    description: "Envoyé juste après l'achat de billets en ligne — billetterie.",
  },
  {
    template: 'invoice_confirmation',
    title: 'Confirmation de paiement',
    description: "Envoyé après le règlement d'une facture en ligne.",
  },
  {
    template: 'inscription_confirmation',
    title: 'Inscription confirmée',
    description: 'Envoyé après une inscription validée, gratuite ou déjà payée.',
  },
  {
    template: 'inscription_payment_request',
    title: 'Demande de paiement',
    description: "Envoyé quand l'inscription est validée par l'organisme mais reste à régler.",
  },
  {
    template: 'inscription_registration_rejected',
    title: 'Justificatif à compléter',
    description: 'Envoyé quand un document déposé par le citoyen est refusé.',
  },
  {
    template: 'inscription_waitlist_offer',
    title: 'Place disponible',
    description: "Envoyé quand une place se libère pour un citoyen en liste d'attente.",
  },
  {
    template: 'inscription_event_cancelled',
    title: 'Évènement annulé',
    description: "Envoyé à tous les inscrits si l'organisme annule l'évènement.",
  },
]

interface RenderedExample {
  template: string
  subject: string
  html: string
}

/**
 * Page dédiée (pas de popup) pour présenter à un client les emails que
 * PayFiP envoie — accessible depuis le widget de démo, mais indépendante :
 * garde son propre contrôle DEMO_MODE (une visite directe sur l'URL, sans
 * être passé par le widget, ne doit rien montrer si le mode est désactivé).
 */
export function DemoEmailsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<string>(CATALOG[0].template)
  const [rendered, setRendered] = useState<RenderedExample | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiCall<{ data: { enabled: boolean } }>('GET', '/demo/status').then((result) => {
      setEnabled(result.ok && result.data.data.enabled)
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setRendered(null)
    apiCall<{ data: RenderedExample }>('GET', `/demo/example-email?template=${selected}`).then((result) => {
      setLoading(false)
      if (result.ok) setRendered(result.data.data)
    })
  }, [enabled, selected])

  if (enabled === null) return null

  if (!enabled) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-400">Mode démo désactivé.</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-gray-50">
      <div className="border-b border-amber-100 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5">
          <div className="squircle flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Sparkles size={17} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-gray-900">Exemples d'emails</h1>
            <p className="text-xs text-gray-400">Mode démo — aperçu des emails envoyés aux citoyens, données factices</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-5 px-6 py-6">
        <div className="flex w-80 shrink-0 flex-col gap-2">
          {CATALOG.map((entry) => (
            <button
              key={entry.template}
              type="button"
              onClick={() => setSelected(entry.template)}
              className={`squircle rounded-2xl border p-3.5 text-left transition ${
                selected === entry.template
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-bold text-gray-900">{entry.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{entry.description}</p>
            </button>
          ))}
        </div>

        <div className="squircle min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {loading && (
            <div className="flex h-full items-center justify-center py-24">
              <p className="text-sm text-gray-400">Chargement…</p>
            </div>
          )}
          {!loading && rendered && (
            <>
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                <Mail size={15} className="text-gray-400" />
                <p className="text-sm font-bold text-gray-900">{rendered.subject}</p>
              </div>
              <iframe
                srcDoc={rendered.html}
                title={rendered.subject}
                sandbox=""
                className="h-[calc(100vh-220px)] w-full border-0 bg-gray-50"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DemoEmailsPage
