import { useState } from 'react'
import { CreditCard, Download, Search } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { downloadCsv } from '@/lib/exportCsv'
import { euros } from '@/lib/format'
import { EmptyState, HeroGhostButton, LoadError, Pagination, StatusBadge, TextInput } from '@/components/ui'
import { StaffHero } from '@/components/staff/StaffHero'
import { genericStatusTint, StaffRow, StaffTable, StaffTableSkeleton, Td } from '@/components/staff/StaffTable'
import type { PageMeta } from '@/lib/types'

const PER_PAGE = 25

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

const PAYMENT_REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  awaiting_payment: 'En cours',
  paid: 'Payée',
  failed: 'Échouée',
  cancelled: 'Annulée',
  expired: 'Expirée',
}

export function StaffPaymentRequestsPage() {
  const { staffToken } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: paymentRequests,
    meta,
    loadFailed,
    reload,
  } = usePaginatedResource<StaffPaymentRequest, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/payment-requests?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, q, page],
  })

  function exportCsv() {
    downloadCsv(
      'demandes-de-paiement.csv',
      ['Référence', 'Origine', 'Montant', 'Statut', 'Date'],
      (paymentRequests ?? []).map((pr) => [
        pr.sourceReference,
        SOURCE_SERVICE_LABELS[pr.sourceService] ?? pr.sourceService,
        euros(pr.amountCents),
        PAYMENT_REQUEST_STATUS_LABELS[pr.status] ?? pr.status,
        new Date(pr.createdAt).toLocaleDateString('fr-FR'),
      ])
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaffHero
        icon={<CreditCard size={13} />}
        eyebrow="PayFiP, tous organismes confondus"
        title="Demandes de paiement"
        actions={
          <HeroGhostButton type="button" onClick={exportCsv} disabled={!paymentRequests || paymentRequests.length === 0}>
            <Download size={14} />
            Exporter
          </HeroGhostButton>
        }
        stats={[{ label: 'Demandes', value: meta ? String(meta.total) : null, icon: <CreditCard size={14} />, tone: 'blue' }]}
      />

      <div className="min-h-0 flex-1">
      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && paymentRequests === null && <StaffTableSkeleton columns={5} />}
      {!loadFailed && paymentRequests?.length === 0 && (
        <EmptyState icon={<CreditCard size={28} />} label="Aucune demande de paiement." />
      )}

      {!loadFailed && paymentRequests && paymentRequests.length > 0 && (
        <StaffTable
          headers={['Référence', 'Origine', 'Montant', 'Statut', 'Date']}
          toolbar={
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
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
          }
          footer={
            meta && meta.lastPage > 1 ? (
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            ) : (
              <p className="text-xs text-gray-400">{meta?.total ?? paymentRequests.length} demande{(meta?.total ?? paymentRequests.length) > 1 ? 's' : ''}</p>
            )
          }
        >
          {paymentRequests.map((pr) => (
            <StaffRow key={pr.id}>
              <Td className="font-mono text-xs font-medium text-gray-900">{pr.sourceReference}</Td>
              <Td>{SOURCE_SERVICE_LABELS[pr.sourceService] ?? pr.sourceService}</Td>
              <Td>{euros(pr.amountCents)}</Td>
              <Td>
                <StatusBadge label={PAYMENT_REQUEST_STATUS_LABELS[pr.status] ?? pr.status} className={genericStatusTint(pr.status)} />
              </Td>
              <Td className="text-gray-400">{new Date(pr.createdAt).toLocaleDateString('fr-FR')}</Td>
            </StaffRow>
          ))}
        </StaffTable>
      )}
      </div>
    </div>
  )
}

export default StaffPaymentRequestsPage
