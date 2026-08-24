import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { StaffLoginForm } from '@/pages/staff/StaffLoginForm'
import { loadStoredStaffKey, clearStoredStaffKey } from '@/lib/storage'
import { StaffAuthProvider } from '@/lib/StaffAuthProvider'
import { ToastProvider } from '@/lib/ToastProvider'

const StaffSpace = lazy(() => import('@/layouts/StaffSpace'))
const StaffOrganizationsPage = lazy(() => import('@/pages/staff/StaffOrganizationsPage'))
const StaffOrganizationDetailPage = lazy(() => import('@/pages/staff/StaffOrganizationDetailPage'))
const StaffServicesPage = lazy(() => import('@/pages/staff/StaffServicesPage'))
const StaffUsersPage = lazy(() => import('@/pages/staff/StaffUsersPage'))
const StaffOrdersPage = lazy(() => import('@/pages/staff/StaffOrdersPage'))
const StaffInvoicesPage = lazy(() => import('@/pages/staff/StaffInvoicesPage'))
const StaffPaymentRequestsPage = lazy(() => import('@/pages/staff/StaffPaymentRequestsPage'))
const StaffEmailsPage = lazy(() => import('@/pages/staff/StaffEmailsPage'))

// Panel staff AREGIE — secret partagé (x-staff-key), pas de compte
// individuel ni de JWT à renouveler, donc pas d'équivalent au refresh
// périodique d'AuthGate. Complètement séparé de l'auth organisme (aucun
// point commun : ni stockage, ni contexte, ni layout).
export function StaffGate() {
  const [staffKey, setStaffKey] = useState<string | null>(() => loadStoredStaffKey())

  function handleLogout() {
    clearStoredStaffKey()
    setStaffKey(null)
  }

  if (!staffKey) {
    return <StaffLoginForm onLoggedIn={setStaffKey} />
  }

  return (
    <StaffAuthProvider value={{ staffKey, onLogout: handleLogout }}>
      <ToastProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<StaffSpace />}>
              <Route path="/" element={<Navigate to="organismes" replace />} />
              <Route path="organismes" element={<StaffOrganizationsPage />} />
              <Route path="organismes/:id" element={<StaffOrganizationDetailPage />} />
              <Route path="services" element={<StaffServicesPage />} />
              <Route path="utilisateurs" element={<StaffUsersPage />} />
              <Route path="commandes" element={<StaffOrdersPage />} />
              <Route path="factures" element={<StaffInvoicesPage />} />
              <Route path="paiements" element={<StaffPaymentRequestsPage />} />
              <Route path="emails" element={<StaffEmailsPage />} />
              <Route path="*" element={<Navigate to="organismes" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </StaffAuthProvider>
  )
}

export default StaffGate
