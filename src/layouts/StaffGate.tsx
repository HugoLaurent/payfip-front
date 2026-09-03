import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { StaffLoginForm } from '@/pages/staff/StaffLoginForm'
import { StaffAuthCallback } from '@/pages/staff/StaffAuthCallback'
import { loadStoredStaffToken, saveStoredStaffToken, clearStoredStaffToken } from '@/lib/storage'
import { decodeJwtPayload } from '@/lib/decodeJwtPayload'
import { StaffAuthProvider } from '@/lib/StaffAuthProvider'
import { ToastProvider } from '@/lib/ToastProvider'

const StaffSpace = lazy(() => import('@/layouts/StaffSpace'))
const StaffOrganizationsPage = lazy(() => import('@/pages/staff/StaffOrganizationsPage'))
const StaffOrganizationDetailPage = lazy(() => import('@/pages/staff/StaffOrganizationDetailPage'))
const StaffServicesPage = lazy(() => import('@/pages/staff/StaffServicesPage'))
const StaffUsersPage = lazy(() => import('@/pages/staff/StaffUsersPage'))
const StaffOrdersPage = lazy(() => import('@/pages/staff/StaffOrdersPage'))
const StaffInvoicesPage = lazy(() => import('@/pages/staff/StaffInvoicesPage'))
const StaffRegistrationsPage = lazy(() => import('@/pages/staff/StaffRegistrationsPage'))
const StaffPaymentRequestsPage = lazy(() => import('@/pages/staff/StaffPaymentRequestsPage'))
const StaffEmailsPage = lazy(() => import('@/pages/staff/StaffEmailsPage'))

interface StaffTokenPayload {
  email: string
  name: string | null
}

interface StaffSession {
  token: string
  email: string
  name: string | null
}

function sessionFromToken(token: string): StaffSession | null {
  const payload = decodeJwtPayload<StaffTokenPayload>(token)
  if (!payload) return null
  return { token, email: payload.email, name: payload.name }
}

// Panel staff AREGIE — SSO Authentik (voir StaffLoginForm/StaffAuthCallback
// pour le flux). Complètement séparé de l'auth organisme (aucun point
// commun : ni stockage, ni contexte, ni layout). `auth/complete` doit
// rester joignable même sans session : c'est la route qui l'établit.
export function StaffGate() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    const token = loadStoredStaffToken()
    return token ? sessionFromToken(token) : null
  })

  function handleLoggedIn(token: string) {
    saveStoredStaffToken(token)
    setSession(sessionFromToken(token))
  }

  function handleLogout() {
    clearStoredStaffToken()
    setSession(null)
  }

  return (
    <Routes>
      <Route path="auth/complete" element={<StaffAuthCallback onLoggedIn={handleLoggedIn} />} />

      {!session ? (
        <Route path="*" element={<StaffLoginForm />} />
      ) : (
        <Route
          element={
            <StaffAuthProvider
              value={{
                staffToken: session.token,
                email: session.email,
                name: session.name,
                onLogout: handleLogout,
              }}
            >
              <ToastProvider>
                <Suspense fallback={null}>
                  <StaffSpace />
                </Suspense>
              </ToastProvider>
            </StaffAuthProvider>
          }
        >
          <Route path="/" element={<Navigate to="organismes" replace />} />
          <Route path="organismes" element={<StaffOrganizationsPage />} />
          <Route path="organismes/:id" element={<StaffOrganizationDetailPage />} />
          <Route path="services" element={<StaffServicesPage />} />
          <Route path="utilisateurs" element={<StaffUsersPage />} />
          <Route path="commandes" element={<StaffOrdersPage />} />
          <Route path="factures" element={<StaffInvoicesPage />} />
          <Route path="inscriptions" element={<StaffRegistrationsPage />} />
          <Route path="paiements" element={<StaffPaymentRequestsPage />} />
          <Route path="emails" element={<StaffEmailsPage />} />
          <Route path="*" element={<Navigate to="organismes" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default StaffGate
