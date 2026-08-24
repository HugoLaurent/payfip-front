import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { History, LayoutDashboard, LogOut, Pencil, ScanLine, ShoppingCart, Store, Users } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { hasBilletteriePermission } from '@/lib/permissions'
import { Modal, PrimaryButton, TextInput } from '@/components/ui'
import { useAuth } from '@/lib/useAuth'

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
              layoutId="sidebar-active-pill"
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

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { auth, onLogout, onAuthUpdate } = useAuth()
  const isAdmin = auth.role === 'admin'
  const fullName = [auth.firstName, auth.lastName].filter(Boolean).join(' ')
  const location = useLocation()

  useEffect(() => {
    onCloseMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [firstName, setFirstName] = useState(auth.firstName ?? '')
  const [lastName, setLastName] = useState(auth.lastName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  function openProfileModal() {
    setFirstName(auth.firstName ?? '')
    setLastName(auth.lastName ?? '')
    setError(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordSuccess(false)
    setShowProfileModal(true)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    const result = await apiCall('PATCH', '/auth/me/password', {
      token: auth.token,
      body: { currentPassword, newPassword },
    })

    setChangingPassword(false)

    if (result.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } else if (result.status === 401) {
      setPasswordError('Mot de passe actuel incorrect.')
    } else if (result.status === 422) {
      setPasswordError('Vous ne pouvez pas réutiliser vos deux derniers mots de passe.')
    } else {
      setPasswordError('Échec du changement de mot de passe.')
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await apiCall<{ data: { firstName: string; lastName: string } }>(
      'PATCH',
      '/auth/me',
      { token: auth.token, body: { firstName, lastName } }
    )

    setSaving(false)

    if (result.ok) {
      onAuthUpdate({ firstName: result.data.data.firstName, lastName: result.data.data.lastName })
      setShowProfileModal(false)
    } else {
      setError('Échec de l’enregistrement.')
    }
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-black/5 bg-white transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <button
        type="button"
        onClick={openProfileModal}
        className="group flex items-center gap-2.5 border-b border-black/5 px-5 py-4 text-left transition hover:bg-gray-50"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center squircle rounded-lg bg-aregie-deep text-sm font-bold text-white">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold text-gray-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {auth.orgName}
          </p>
          <p className="truncate text-xs text-gray-500">
            {fullName || (isAdmin ? 'Administrateur' : 'Agent')}
          </p>
        </div>
        <Pencil size={13} className="shrink-0 text-gray-300 opacity-0 transition group-hover:opacity-100" />
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <SidebarLink to="/dashboard" icon={LayoutDashboard} onNavigate={onCloseMobile}>
          Tableau de bord
        </SidebarLink>

        <SidebarLink to="/services" icon={Store} onNavigate={onCloseMobile}>
          Services
        </SidebarLink>

        {hasBilletteriePermission(auth, 'canSell') && (
          <SidebarLink to="/vente" icon={ShoppingCart} onNavigate={onCloseMobile}>
            Vente
          </SidebarLink>
        )}

        {hasBilletteriePermission(auth, 'canViewHistory') && (
          <SidebarLink to="/historique" icon={History} onNavigate={onCloseMobile}>
            Historique
          </SidebarLink>
        )}

        {hasBilletteriePermission(auth, 'canScan') && (
          <SidebarLink to="/scanner" icon={ScanLine} onNavigate={onCloseMobile}>
            Scanner
          </SidebarLink>
        )}

        {isAdmin && (
          <SidebarLink to="/utilisateurs" icon={Users} onNavigate={onCloseMobile}>
            Utilisateurs
          </SidebarLink>
        )}
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

      {showProfileModal && (
        <Modal title="Mon profil" onClose={() => setShowProfileModal(false)}>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="flex gap-3">
              <TextInput
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <TextInput
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <PrimaryButton type="submit" disabled={saving} className="w-full">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
          </form>

          <form onSubmit={handleChangePassword} className="mt-6 space-y-3 border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700">Mot de passe</p>
            <TextInput
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <TextInput
              type="password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <TextInput
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-emerald-600">Mot de passe changé.</p>}
            <PrimaryButton type="submit" disabled={changingPassword} className="w-full">
              {changingPassword ? 'Changement…' : 'Changer le mot de passe'}
            </PrimaryButton>
          </form>
        </Modal>
      )}
      </aside>
    </>
  )
}
