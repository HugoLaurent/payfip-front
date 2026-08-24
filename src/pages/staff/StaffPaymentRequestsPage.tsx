import { useState } from 'react'
import { CreditCard, Search } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { EmptyState, LoadError, PageHeader, Pagination, StatusBadge, TextInput } from '@/components/ui'
import { genericStatusTint, StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import type { PageMeta } from '@/lib/types'

const PER_PAGE = 25

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`
}

interface StaffPaymentRequest {
  id: number
  createdAt: string
  orgId: number
  sourceService: string
  sourceReference: string
  amountCents: number
  status: string
  paidAt: string | null
}

const SOURCE_SERVICE_LABELS: Record<string, string> = { billetterie: 'Billetterie', factures: 'Facture' }

export function StaffPaymentRequestsPage() {
  const { staffKey } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: paymentRequests,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffPaymentRequest, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/payment-requests?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`,
        { staffKey }
      ),
    deps: [staffKey, q, page],
  })

  return (
    <div>
      <PageHeader icon={<CreditCard size={20} />} title="Demandes de paiement" subtitle="PayFiP, tous organismes confondus" />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Référence…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && paymentRequests?.length === 0 && (
        <EmptyState icon={<CreditCard size={28} />} label="Aucune demande de paiement." />
      )}

      {!loadFailed && paymentRequests && paymentRequests.length > 0 && (
        <>
          <StaffTable headers={['Référence', 'Origine', 'Montant', 'Statut', 'Date']}>
            {paymentRequests.map((pr) => (
              <StaffRow key={pr.id}>
                <Td className="font-mono text-xs font-medium text-gray-900">{pr.sourceReference}</Td>
                <Td>{SOURCE_SERVICE_LABELS[pr.sourceService] ?? pr.sourceService}</Td>
                <Td>{euros(pr.amountCents)}</Td>
                <Td>
                  <StatusBadge label={pr.status} className={genericStatusTint(pr.status)} />
                </Td>
                <Td className="text-gray-400">{new Date(pr.createdAt).toLocaleDateString('fr-FR')}</Td>
              </StaffRow>
            ))}
          </StaffTable>
          {meta && meta.lastPage > 1 && (
            <div className="mt-4 squircle rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(20,25,60,0.06)]">
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StaffPaymentRequestsPage
