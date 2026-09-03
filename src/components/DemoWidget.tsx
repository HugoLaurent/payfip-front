import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Sparkles, X } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { saveStoredAuth, clearStoredAuth, clearStoredStaffToken } from '@/lib/storage'
import type { AuthState } from '@/lib/types'

type JourneyKey = 'billetterie' | 'inscription' | 'factures'

interface DemoConfig {
  journeys: Record<JourneyKey, string | null>
  citizen: { email: string; firstName: string; lastName: string }
}

const JOURNEY_LABELS: Record<JourneyKey, string> = {
  billetterie: 'Billetterie',
  inscription: 'Inscription',
  factures: 'Facture',
}

// Ajoute les infos citoyen démo à un lien de parcours sans jamais deviner
// ce que la page cible attend : chaque page publique ignore simplement les
// paramètres qu'elle ne lit pas (billetterie/facture n'ont pas de nom).
function withCitizenParams(path: string, citizen: DemoConfig['citizen']): string {
  const params = new URLSearchParams({
    demoEmail: citizen.email,
    demoFirstName: citizen.firstName,
    demoLastName: citizen.lastName,
  })
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`
}

/**
 * Widget de démo commerciale — invisible tant que le gateway ne répond pas
 * DEMO_MODE=true (voir demo_controller.ts), donc sans effet sur un
 * déploiement où la variable d'env n'est pas explicitement posée. Ne fait
 * jamais de suppositions sur la session en cours : les identifiants réels
 * du profil démo restent côté serveur, jamais dans ce composant.
 */
export function DemoWidget() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<DemoConfig | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiCall<{ data: { enabled: boolean } }>('GET', '/demo/status').then((result) => {
      if (!cancelled && result.ok && result.data.data.enabled) setEnabled(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function togglePanel() {
    const next = !open
    setOpen(next)
    if (next && !config) {
      const result = await apiCall<{ data: DemoConfig }>('GET', '/demo/config')
      if (result.ok) setConfig(result.data.data)
    }
  }

  async function loginAdmin() {
    setBusy(true)
    const result = await apiCall<{ data: AuthState }>('POST', '/demo/admin-login')
    setBusy(false)
    if (result.ok) {
      saveStoredAuth(result.data.data)
      window.location.href = '/dashboard'
    }
  }

  function logout() {
    clearStoredAuth()
    clearStoredStaffToken()
    window.location.href = '/'
  }

  if (!enabled) return null

  const journeys = config
    ? (Object.entries(config.journeys) as [JourneyKey, string | null][]).filter(([, path]) => path)
    : []

  return createPortal(
    <div className="fixed right-4 bottom-4 z-[9999]" style={{ fontFamily: 'var(--font-public, system-ui)' }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="squircle mb-2 w-64 rounded-[18px] border border-amber-200 bg-white p-3 shadow-[0_20px_45px_-15px_rgba(20,25,60,0.35)]"
          >
            <p className="mb-2 px-1 text-xs font-bold tracking-wide text-amber-600 uppercase">Mode démo</p>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={loginAdmin}
                disabled={busy}
                className="squircle rounded-xl bg-aregie-deep/10 px-3 py-2 text-left text-sm font-semibold text-aregie-deep transition hover:bg-aregie-deep/15 disabled:opacity-60"
              >
                {busy ? 'Connexion…' : 'Connexion Admin'}
              </button>
              <a
                href="/demo/emails"
                target="_blank"
                rel="noreferrer"
                className="squircle flex items-center gap-1.5 rounded-xl bg-aregie-deep/10 px-3 py-2 text-sm font-semibold text-aregie-deep transition hover:bg-aregie-deep/15"
              >
                <Mail size={14} />
                Exemples d'emails
              </a>
            </div>

            {journeys.length > 0 && config && (
              <>
                <p className="mt-3 mb-1.5 px-1 text-xs font-bold tracking-wide text-gray-400 uppercase">
                  Parcours citoyen — {config.citizen.firstName} {config.citizen.lastName}
                </p>
                <div className="flex flex-col gap-1.5">
                  {journeys.map(([key, path]) => (
                    <a
                      key={key}
                      href={withCitizenParams(path!, config.citizen)}
                      target="_blank"
                      rel="noreferrer"
                      className="squircle rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                      {JOURNEY_LABELS[key]}
                    </a>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={logout}
              className="mt-3 w-full px-1 text-left text-xs font-medium text-gray-400 transition hover:text-red-500"
            >
              Déconnexion démo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={togglePanel}
        aria-label="Widget de démo"
        className="squircle flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_10px_25px_-8px_rgba(217,119,6,0.6)] transition hover:bg-amber-600"
      >
        {open ? <X size={18} /> : <Sparkles size={18} />}
      </button>
    </div>,
    document.body,
  )
}
