import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginForm } from '@/pages/auth/LoginForm'
import { ForcedPasswordChange } from '@/pages/auth/ForcedPasswordChange'
import { apiCall } from '@/lib/api'
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from '@/lib/storage'
import { AuthProvider } from '@/lib/AuthProvider'
import { ToastProvider } from '@/lib/ToastProvider'
import type { AuthState } from '@/lib/types'

interface RefreshResponse {
  data: AuthState
}

// Le JWT client vit 2h — on le renouvelle bien avant (et on récupère au
// passage le nom d'org/services à jour, ex: un renommage pendant que la
// page reste ouverte) plutôt que de laisser la session mourir sèchement.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000

// Chargés à la demande : l'espace organisme (Dashboard, ServicesPage,
// ScannerPage/jsQR…) ne doit peser sur le bundle que pour les usagers
// effectivement connectés, jamais pour le parcours citoyen public. Un
// chunk par page plutôt qu'un seul gros chunk "OrgSpace" : ScannerPage
// (jsQR) ne se charge par ex. que quand l'agent clique "Scanner".
const OrgSpace = lazy(() => import('@/layouts/OrgSpace'))
const Dashboard = lazy(() => import('@/pages/org/Dashboard'))
const ServicesPage = lazy(() => import('@/pages/org/ServicesPage'))
const ServiceAdmin = lazy(() => import('@/pages/org/ServiceAdmin'))
const UsersManager = lazy(() => import('@/pages/org/UsersManager'))
const VentePage = lazy(() => import('@/pages/org/VentePage'))
const HistoriquePage = lazy(() => import('@/pages/org/HistoriquePage'))
const ScannerPage = lazy(() => import('@/pages/org/ScannerPage'))

// Espace organisme (agents/admins) — extrait pour laisser App.tsx router
// entre ce parcours authentifié et le parcours d'achat public (aucun
// point commun : ni auth, ni layout).
export function AuthGate() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadStoredAuth<AuthState>())
  // Le refresh met à jour `auth` (nouveau token) — sans cette ref, l'effet
  // ci-dessous se re-déclencherait à chaque renouvellement et boderait en
  // boucle. On ne veut redémarrer la boucle qu'à une vraie connexion.
  const authRef = useRef(auth)
  authRef.current = auth

  useEffect(() => {
    if (!auth) return

    let cancelled = false

    async function refresh() {
      const current = authRef.current
      if (!current) return
      const result = await apiCall<RefreshResponse>('POST', '/auth/refresh', { token: current.token })
      if (!cancelled && result.ok) {
        saveStoredAuth(result.data.data)
        setAuth(result.data.data)
      }
    }

    refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // Volontaire : ne redémarre que sur une vraie connexion/déconnexion,
    // jamais sur un simple renouvellement de token par ce même effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth === null])

  function handleLogout() {
    clearStoredAuth()
    setAuth(null)
  }

  function updateAuth(patch: Partial<AuthState>) {
    setAuth((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      saveStoredAuth(next)
      return next
    })
  }

  if (!auth) {
    return <LoginForm onLoggedIn={setAuth} />
  }

  if (auth.passwordChangeRequired) {
    return <ForcedPasswordChange auth={auth} onChanged={updateAuth} onLogout={handleLogout} />
  }

  return (
    <AuthProvider value={{ auth, onLogout: handleLogout, onAuthUpdate: updateAuth }}>
      <ToastProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<OrgSpace />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:id" element={<ServiceAdmin />} />
              <Route path="/vente" element={<VentePage />} />
              <Route path="/historique" element={<HistoriquePage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              {auth.role === 'admin' && (
                <Route path="/utilisateurs" element={<UsersManager />} />
              )}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  )
}
