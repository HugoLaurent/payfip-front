import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { StaffSidebar } from './StaffSidebar'

export function StaffSpace() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div
      className="flex h-svh overflow-hidden bg-gradient-to-b from-aregie-deep/5 to-transparent"
      style={{ fontFamily: 'var(--font-public)' }}
    >
      <StaffSidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center squircle rounded-lg text-gray-500 transition hover:bg-gray-100"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <p className="truncate text-sm font-semibold text-gray-900">Panel staff AREGIE</p>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default StaffSpace
