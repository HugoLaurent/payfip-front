import { useState } from 'react'
import { FileText, Search } from 'lucide-react'
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

interface StaffInvoice {
  id: number
  createdAt: string
  orgId: number
  serviceId: number | null
  hospitalReference: string
  paymentReference: string | null
  status: string
  amountCents: number
  objectLabel: string
}

export function StaffInvoicesPage() {
  const { staffToken } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: invoices,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffInvoice, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/invoices?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`, {
        staffToken,
      }),
    deps: [staffToken, q, page],
  })

  return (
    <div>
      <PageHeader icon={<FileText size={20} />} title="Factures" subtitle="Tous organismes confondus" />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Référence hospitalière ou de paiement…"
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
      {!loadFailed && invoices?.length === 0 && <EmptyState icon={<FileText size={28} />} label="Aucune facture." />}

      {!loadFailed && invoices && invoices.length > 0 && (
        <>
          <StaffTable headers={['Référence', 'Objet', 'Montant', 'Statut', 'Date']}>
            {invoices.map((inv) => (
              <StaffRow key={inv.id}>
                <Td className="font-mono text-xs font-medium text-gray-900">
                  {inv.paymentReference ?? inv.hospitalReference}
                </Td>
                <Td>{inv.objectLabel}</Td>
                <Td>{euros(inv.amountCents)}</Td>
                <Td>
                  <StatusBadge label={inv.status} className={genericStatusTint(inv.status)} />
                </Td>
                <Td className="text-gray-400">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</Td>
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

export default StaffInvoicesPage
