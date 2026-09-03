import { useState } from 'react'
import { Search, UserCheck } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useStaffOrgOptions } from '@/lib/useStaffOrgOptions'
import {
  EmptyState,
  LoadError,
  Modal,
  PageHeader,
  Pagination,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { genericStatusTint, StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import type { PageMeta } from '@/lib/types'

const PER_PAGE = 25

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`
}

interface StaffRegistration {
  id: number
  createdAt: string
  orgId: number
  serviceId: number
  eventId: number
  firstName: string
  lastName: string
  email: string
  status: string
  amountCents: number
  paymentMethod: string
  registrationReference: string
}

interface PaymentAttempt {
  id: number
  status: string
  createdAt: string
  paidAt: string | null
  isRetry: boolean
}

export function StaffRegistrationsPage() {
  const { staffToken } = useStaffAuth()
  const orgs = useStaffOrgOptions()
  const [orgId, setOrgId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StaffRegistration | null>(null)
  const [attempts, setAttempts] = useState<PaymentAttempt[] | null>(null)
  const [attemptsFailed, setAttemptsFailed] = useState(false)

  const {
    data: registrations,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffRegistration, PageMeta>({
    fetcher: () =>
      apiCall(
        'GET',
        `/staff/registrations?orgId=${orgId}${q ? `&q=${encodeURIComponent(q)}` : ''}&page=${page}&perPage=${PER_PAGE}`,
        { staffToken }
      ),
    deps: [staffToken, orgId, q, page],
    enabled: orgId !== '',
  })

  async function openAttempts(registration: StaffRegistration) {
    setSelected(registration)
    setAttempts(null)
    setAttemptsFailed(false)

    const result = await apiCall<{ data: PaymentAttempt[] }>(
      'GET',
      `/staff/registrations/${registration.id}/payment-attempts?serviceId=${registration.serviceId}`,
      { staffToken }
    )
    if (result.ok) setAttempts(result.data.data)
    else setAttemptsFailed(true)
  }

  return (
    <div>
      <PageHeader icon={<UserCheck size={20} />} title="Inscriptions" subtitle="Par organisme" />

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
            placeholder="Nom, email ou référence…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </div>

      {orgId === '' && (
        <EmptyState icon={<UserCheck size={28} />} label="Choisissez un organisme pour voir ses inscriptions." />
      )}
      {orgId !== '' && loadFailed && <LoadError onRetry={reload} />}
      {orgId !== '' && !loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
      {orgId !== '' && !loadFailed && registrations?.length === 0 && (
        <EmptyState icon={<UserCheck size={28} />} label="Aucune inscription." />
      )}

      {orgId !== '' && !loadFailed && registrations && registrations.length > 0 && (
        <>
          <StaffTable headers={['Référence', 'Nom', 'Montant', 'Statut', 'Date']}>
            {registrations.map((r) => (
              <StaffRow key={r.id} onClick={() => openAttempts(r)}>
                <Td className="font-mono text-xs font-medium text-gray-900">{r.registrationReference}</Td>
                <Td>
                  {r.firstName} {r.lastName}
                  <span className="ml-1.5 text-gray-400">{r.email}</span>
                </Td>
                <Td>{euros(r.amountCents)}</Td>
                <Td>
                  <StatusBadge label={r.status} className={genericStatusTint(r.status)} />
                </Td>
                <Td className="text-gray-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</Td>
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

      {selected && (
        <Modal title="Tentatives de paiement" onClose={() => setSelected(null)}>
          <p className="mb-3 font-mono text-xs text-gray-500">{selected.registrationReference}</p>
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

export default StaffRegistrationsPage
