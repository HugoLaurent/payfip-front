import { useState } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useStaffOrgOptions } from '@/lib/useStaffOrgOptions'
import { EmptyState, LoadError, PageHeader, Pagination, SelectInput, StatusBadge, TextInput } from '@/components/ui'
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
  const orgs = useStaffOrgOptions()
  const [orgId, setOrgId] = useState('')
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
      apiCall(
        'GET',
        `/staff/orders?orgId=${orgId}${q ? `&q=${encodeURIComponent(q)}` : ''}&page=${page}&perPage=${PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, orgId, q, page],
    enabled: orgId !== '',
  })

  return (
    <div>
      <PageHeader icon={<ShoppingCart size={20} />} title="Commandes" subtitle="Billetterie, par organisme" />

      <div className="mb-4 flex gap-2.5">
        <SelectInput
          value={orgId}
          onChange={(e) => {
            setOrgId(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        >
          <option value="">Choisir un organisme…</option>
          {orgs?.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </SelectInput>
        <div className="relative flex-1">
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
      </div>

      {orgId === '' && <EmptyState icon={<ShoppingCart size={28} />} label="Choisissez un organisme pour voir ses commandes." />}
      {orgId !== '' && loadFailed && <LoadError onRetry={reload} />}
      {orgId !== '' && !loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {orgId !== '' && !loadFailed && orders?.length === 0 && (
        <EmptyState icon={<ShoppingCart size={28} />} label="Aucune commande." />
      )}

      {orgId !== '' && !loadFailed && orders && orders.length > 0 && (
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
