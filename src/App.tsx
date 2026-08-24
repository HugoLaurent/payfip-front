import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthGate } from '@/layouts/AuthGate'
import { StaffGate } from '@/layouts/StaffGate'

// Parcours citoyen public — chargé à la demande : jamais utile pour un
// agent connecté, et inversement (voir AuthGate pour le lazy de
// l'espace organisme).
const PublicPurchasePage = lazy(() => import('@/pages/public/PublicPurchasePage'))
const PurchaseReturnPage = lazy(() => import('@/pages/public/PurchaseReturnPage'))
const PublicInvoicePage = lazy(() => import('@/pages/public/PublicInvoicePage'))
const InvoiceReturnPage = lazy(() => import('@/pages/public/InvoiceReturnPage'))

function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/billetterie/:slug" element={<PublicPurchasePage />} />
        <Route path="/billetterie/:slug/retour" element={<PurchaseReturnPage />} />
        <Route path="/factures/:slug" element={<PublicInvoicePage />} />
        <Route path="/factures/:slug/retour" element={<InvoiceReturnPage />} />
        <Route path="/staff/*" element={<StaffGate />} />
        <Route path="/*" element={<AuthGate />} />
      </Routes>
    </Suspense>
  )
}

export default App
