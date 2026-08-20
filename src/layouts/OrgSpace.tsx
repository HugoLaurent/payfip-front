import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Dashboard } from '@/pages/org/Dashboard'
import { ServicesPage } from '@/pages/org/ServicesPage'
import { ServiceAdmin } from '@/pages/org/ServiceAdmin'
import { UsersManager } from '@/pages/org/UsersManager'
import { VentePage } from '@/pages/org/VentePage'
import { HistoriquePage } from '@/pages/org/HistoriquePage'
import { ScannerPage } from '@/pages/org/ScannerPage'
import type { AuthState } from '@/lib/types'

export function OrgSpace({
  auth,
  onLogout,
  onAuthUpdate,
}: {
  auth: AuthState
  onLogout: () => void
  onAuthUpdate: (patch: Partial<AuthState>) => void
}) {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-svh overflow-hidden bg-gradient-to-b from-aregie-deep/5 to-transparent">
      <Sidebar
        auth={auth}
        onLogout={onLogout}
        onAuthUpdate={onAuthUpdate}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <p className="truncate text-sm font-semibold text-gray-900">{auth.orgName}</p>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard auth={auth} />} />
                <Route path="/services" element={<ServicesPage auth={auth} />} />
                <Route path="/services/:id" element={<ServiceAdmin auth={auth} />} />
                <Route path="/vente" element={<VentePage auth={auth} />} />
                <Route path="/historique" element={<HistoriquePage auth={auth} />} />
                <Route path="/scanner" element={<ScannerPage auth={auth} />} />
                {auth.role === 'admin' && (
                  <Route path="/utilisateurs" element={<UsersManager auth={auth} />} />
                )}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
        </main>
      </div>
    </div>
  )
}

export default OrgSpace
