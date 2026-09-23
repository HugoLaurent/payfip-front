import { useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useStaffOrgOptions } from '@/lib/useStaffOrgOptions'
import { downloadCsv } from '@/lib/exportCsv'
import {
  Card,
  EmptyState,
  HeroGhostButton,
  LoadError,
  Modal,
  Pagination,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { StaffHero } from '@/components/staff/StaffHero'
import { genericStatusTint, StaffRow, StaffTable, StaffTableSkeleton, Td } from '@/components/staff/StaffTable'
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

interface PaymentAttempt {
  id: number
  status: string
  createdAt: string
  paidAt: string | null
  isRetry: boolean
}

export function StaffInvoicesPage() {
  const { staffToken } = useStaffAuth()
  const orgs = useStaffOrgOptions()
  const [orgId, setOrgId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StaffInvoice | null>(null)
  const [attempts, setAttempts] = useState<PaymentAttempt[] | null>(null)
  const [attemptsFailed, setAttemptsFailed] = useState(false)

  const {
    data: invoices,
    meta,
    loadFailed,
    reload,
  } = usePaginatedResource<StaffInvoice, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/invoices?orgId=${orgId}${q ? `&q=${encodeURIComponent(q)}` : ''}&page=${page}&perPage=${PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, orgId, q, page],
    enabled: orgId !== '',
  })

  async function openAttempts(invoice: StaffInvoice) {
    setSelected(invoice)
    setAttempts(null)
    setAttemptsFailed(false)

    if (!invoice.serviceId) {
      setAttempts([])
      return
    }

    const result = await apiCall<{ data: PaymentAttempt[] }>(
      'GET',
      `/staff/invoices/${invoice.id}/payment-attempts?serviceId=${invoice.serviceId}`,
      { staffToken }
    )
    if (result.ok) setAttempts(result.data.data)
    else setAttemptsFailed(true)
  }

  function exportCsv() {
    downloadCsv(
      'factures.csv',
      ['Référence', 'Objet', 'Montant', 'Statut', 'Date'],
      (invoices ?? []).map((inv) => [
        inv.paymentReference ?? inv.hospitalReference,
        inv.objectLabel,
        euros(inv.amountCents),
        inv.status,
        new Date(inv.createdAt).toLocaleDateString('fr-FR'),
      ])
    )
  }

  return (
    <div>
      <StaffHero
        icon={<FileText size={13} />}
        eyebrow="Par organisme"
        title="Factures"
        actions={
          <HeroGhostButton type="button" onClick={exportCsv} disabled={!invoices || invoices.length === 0}>
            <Download size={14} />
            Exporter
          </HeroGhostButton>
        }
        stats={
          orgId !== ''
            ? [{ label: 'Factures', value: meta ? String(meta.total) : null, icon: <FileText size={14} />, tone: 'blue' }]
            : undefined
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2.5 p-3">
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
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
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
      </Card>

      {orgId === '' && <EmptyState icon={<FileText size={28} />} label="Choisissez un organisme pour voir ses factures." />}
      {orgId !== '' && loadFailed && <LoadError onRetry={reload} />}
      {orgId !== '' && !loadFailed && invoices === null && <StaffTableSkeleton columns={5} toolbar={false} />}
      {orgId !== '' && !loadFailed && invoices?.length === 0 && <EmptyState icon={<FileText size={28} />} label="Aucune facture." />}

      {orgId !== '' && !loadFailed && invoices && invoices.length > 0 && (
        <StaffTable
          headers={['Référence', 'Objet', 'Montant', 'Statut', 'Date']}
          footer={
            meta && meta.lastPage > 1 ? (
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            ) : (
              <p className="text-xs text-gray-400">{meta?.total ?? invoices.length} facture{(meta?.total ?? invoices.length) > 1 ? 's' : ''}</p>
            )
          }
        >
          {invoices.map((inv) => (
            <StaffRow key={inv.id} onClick={() => openAttempts(inv)}>
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
      )}

      {selected && (
        <Modal title="Tentatives de paiement" onClose={() => setSelected(null)}>
          <p className="mb-3 font-mono text-xs text-gray-500">
            {selected.paymentReference ?? selected.hospitalReference}
          </p>
          {attemptsFailed && <LoadError onRetry={() => openAttempts(selected)} />}
          {!attemptsFailed && attempts === null && <p className="text-sm text-gray-500">Chargement…</p>}
          {!attemptsFailed && attempts?.length === 0 && (
            <p className="text-sm text-gray-400">Aucune tentative de paiement enregistrée.</p>
          )}
          {attempts?.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
              <span className="text-gray-600">{a.isRetry ? 'Nouvelle tentative' : 'Tentative'} — {a.status}</span>
              <span className="text-gray-400">
                {new Date(a.paidAt ?? a.createdAt).toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}

export default StaffInvoicesPage
