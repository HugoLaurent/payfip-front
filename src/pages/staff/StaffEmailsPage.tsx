import { useState } from 'react'
import { Mail, Search } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { EmptyState, LoadError, PageHeader, Pagination, StatusBadge, TextInput } from '@/components/ui'
import { genericStatusTint, StaffRow, StaffTable, Td } from '@/components/staff/StaffTable'
import type { PageMeta } from '@/lib/types'

const PER_PAGE = 25

interface StaffEmail {
  id: number
  template: string
  toEmail: string
  status: string
  attempts: number
  error: string | null
  createdAt: string
  sentAt: string | null
}

export function StaffEmailsPage() {
  const { staffKey } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: emails,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffEmail, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/emails?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`, {
        staffKey,
      }),
    deps: [staffKey, q, page],
  })

  return (
    <div>
      <PageHeader icon={<Mail size={20} />} title="Emails" subtitle="Envois, tous organismes confondus" />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Destinataire…"
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
      {!loadFailed && emails?.length === 0 && <EmptyState icon={<Mail size={28} />} label="Aucun email." />}

      {!loadFailed && emails && emails.length > 0 && (
        <>
          <StaffTable headers={['Destinataire', 'Modèle', 'Tentatives', 'Statut', 'Date']}>
            {emails.map((e) => (
              <StaffRow key={e.id}>
                <Td className="font-medium text-gray-900">{e.toEmail}</Td>
                <Td>{e.template}</Td>
                <Td>{e.attempts}</Td>
                <Td>
                  <StatusBadge label={e.status} className={genericStatusTint(e.status)} />
                  {e.error && <p className="mt-1 text-xs text-red-500">{e.error}</p>}
                </Td>
                <Td className="text-gray-400">{new Date(e.createdAt).toLocaleDateString('fr-FR')}</Td>
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

export default StaffEmailsPage
