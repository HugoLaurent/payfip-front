import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, CreditCard, FileText, LogOut, Mail, ShoppingCart, Store, Users } from 'lucide-react'
import { useStaffAuth } from '@/lib/useStaffAuth'

function SidebarLink({
  to,
  icon: Icon,
  onNavigate,
  children,
}: {
  to: string
  icon: React.ComponentType<{ size?: number }>
  onNavigate: () => void
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `squircle relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          isActive ? '' : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="staff-sidebar-active-pill"
              className="squircle absolute inset-0 rounded-lg bg-aregie-deep shadow-sm"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className={`relative z-10 flex items-center gap-2.5 ${isActive ? 'text-white' : ''}`}>
            <Icon size={17} />
            <span className="truncate">{children}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

export function StaffSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { onLogout } = useStaffAuth()
  const location = useLocation()

  useEffect(() => {
    onCloseMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onCloseMobile} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-black/5 bg-white transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-black/5 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center squircle rounded-lg bg-aregie-deep text-sm font-bold text-white">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              Panel staff
            </p>
            <p className="truncate text-xs text-gray-500">AREGIE</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <SidebarLink to="/staff/organismes" icon={Building2} onNavigate={onCloseMobile}>
            Organismes
          </SidebarLink>
          <SidebarLink to="/staff/services" icon={Store} onNavigate={onCloseMobile}>
            Services
          </SidebarLink>
          <SidebarLink to="/staff/utilisateurs" icon={Users} onNavigate={onCloseMobile}>
            Utilisateurs
          </SidebarLink>
          <SidebarLink to="/staff/commandes" icon={ShoppingCart} onNavigate={onCloseMobile}>
            Commandes
          </SidebarLink>
          <SidebarLink to="/staff/factures" icon={FileText} onNavigate={onCloseMobile}>
            Factures
          </SidebarLink>
          <SidebarLink to="/staff/paiements" icon={CreditCard} onNavigate={onCloseMobile}>
            Demandes de paiement
          </SidebarLink>
          <SidebarLink to="/staff/emails" icon={Mail} onNavigate={onCloseMobile}>
            Emails
          </SidebarLink>
        </nav>

        <div className="border-t border-black/5 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 squircle rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-100"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
