import { useState } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
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

interface StaffOrder {
  id: number
  createdAt: string
  orgId: number
  serviceId: number
  email: string
  qtyTickets: number
  totalAmountCents: number
  status: string
  paymentReference: string
}

export function StaffOrdersPage() {
  const { staffToken } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: orders,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffOrder, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/orders?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`, {
        staffToken,
      }),
    deps: [staffToken, q, page],
  })

  return (
    <div>
      <PageHeader icon={<ShoppingCart size={20} />} title="Commandes" subtitle="Billetterie, tous organismes confondus" />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Référence ou email…"
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
      {!loadFailed && orders?.length === 0 && <EmptyState icon={<ShoppingCart size={28} />} label="Aucune commande." />}

      {!loadFailed && orders && orders.length > 0 && (
        <>
          <StaffTable headers={['Référence', 'Email', 'Billets', 'Montant', 'Statut', 'Date']}>
            {orders.map((o) => (
              <StaffRow key={o.id}>
                <Td className="font-mono text-xs font-medium text-gray-900">{o.paymentReference}</Td>
                <Td>{o.email}</Td>
                <Td>{o.qtyTickets}</Td>
                <Td>{euros(o.totalAmountCents)}</Td>
                <Td>
                  <StatusBadge label={o.status} className={genericStatusTint(o.status)} />
                </Td>
                <Td className="text-gray-400">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</Td>
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

export default StaffOrdersPage
