import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationBell'
import { useAuth } from '@/lib/useAuth'

// Layout pur : structure (sidebar + zone de contenu) et rien d'autre —
// la table de routes organisme vit dans AuthGate, seul endroit qui a
// déjà besoin de connaître `auth.role` pour la route Utilisateurs.
export function OrgSpace() {
  const { auth } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Le Dashboard (cartes de stats côte à côte, "Top services" + "Activité
  // récente" en deux colonnes) a besoin de plus de largeur que les autres
  // pages, restées volontairement étroites (formulaires/listes verticales).
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/'
  // La fiche service (tarifs, évènements/inscriptions…) est une page de
  // listes façon tableau — les mêmes lignes que sur le Dashboard ont besoin
  // de la même largeur pour respirer, contrairement aux formulaires
  // verticaux qui restent volontairement étroits.
  const isServiceDetail = /^\/services\/[^/]+/.test(location.pathname)
  const isWide = isDashboard || isServiceDetail
  // Le scanner est un outil de terrain, pas une page de formulaire : sur
  // téléphone (< 768px, seuil du tiroir mobile de la Sidebar), il devient
  // plein écran immersif — ScannerPage se positionne alors lui-même en
  // `fixed inset-0` (voir ScannerPage/index.tsx) par-dessus tout, y
  // compris cette barre mobile. On la garde quand même montée (sombre,
  // fondue dans le viseur) plutôt que masquée : c'est le seul chemin vers
  // le tiroir de navigation tant que le scanner occupe tout l'écran.
  const isScanner = location.pathname === '/scanner'

  return (
    <div
      className="flex h-svh overflow-hidden bg-gradient-to-b from-aregie-deep/5 to-transparent"
      style={{ fontFamily: 'var(--font-public)' }}
    >
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      {/* Cloche de notif en survol (fixed) — jamais un bandeau qui pousse
          le contenu. Une seule instance montée, positionnée au-dessus de
          tout, plutôt qu'une copie par barre responsive (double polling). */}
      {!isScanner && (
        <div className="fixed top-3 right-4 z-30 md:top-4 md:right-6">
          <NotificationBell auth={auth} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={`flex items-center gap-3 border-b px-4 md:hidden ${
            isScanner ? 'border-white/10 bg-[#0a0d18] py-1.5' : 'border-black/5 bg-white py-3'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className={`flex shrink-0 items-center justify-center squircle rounded-lg transition ${
              isScanner ? 'h-7 w-7 text-white/80 hover:bg-white/10' : 'h-9 w-9 text-gray-500 hover:bg-gray-100'
            }`}
            aria-label="Ouvrir le menu"
          >
            <Menu size={isScanner ? 17 : 20} />
          </button>
          <p className={`truncate font-semibold ${isScanner ? 'text-xs text-white/85' : 'text-sm text-gray-900'}`}>
            {auth.orgName}
          </p>
        </div>

        <main
          className={
            isScanner
              ? 'relative flex-1 overflow-hidden md:overflow-y-auto md:px-8 md:py-8'
              : 'flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8'
          }
        >
          <div className={isScanner ? 'h-full md:mx-auto md:h-auto md:max-w-5xl' : `mx-auto ${isWide ? 'max-w-5xl' : 'max-w-2xl'}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default OrgSpace
