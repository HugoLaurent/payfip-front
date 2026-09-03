import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Mail, Search, X } from 'lucide-react'
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

interface StaffEmailDetail {
  id: number
  template: string
  toEmail: string
  status: string
  subject: string
  html: string
}

export function StaffEmailsPage() {
  const { staffToken } = useStaffAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [previewing, setPreviewing] = useState<StaffEmailDetail | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)

  const {
    data: emails,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<StaffEmail, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/staff/emails?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${page}&perPage=${PER_PAGE}`, {
        staffToken,
      }),
    deps: [staffToken, q, page],
  })

  // Rendu à la demande (voir StaffController#show côté svc-mail, appelé
  // seulement au clic) — les lignes 'fake' (mode démo) n'ont jamais été
  // vraiment envoyées, c'est le seul moyen de voir leur contenu.
  async function openPreview(id: number) {
    setPreviewLoadingId(id)
    const result = await apiCall<{ data: StaffEmailDetail }>('GET', `/staff/emails/${id}`, { staffToken })
    setPreviewLoadingId(null)
    if (result.ok) setPreviewing(result.data.data)
  }

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
              <StaffRow key={e.id} onClick={() => openPreview(e.id)}>
                <Td className="font-medium text-gray-900">{e.toEmail}</Td>
                <Td>{e.template}</Td>
                <Td>{e.attempts}</Td>
                <Td>
                  <StatusBadge label={e.status} className={genericStatusTint(e.status)} />
                  {e.error && <p className="mt-1 text-xs text-red-500">{e.error}</p>}
                </Td>
                <Td className="text-gray-400">
                  {new Date(e.createdAt).toLocaleDateString('fr-FR')}
                  {previewLoadingId === e.id && <span className="ml-1.5 text-gray-400">…</span>}
                </Td>
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

      {previewing &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setPreviewing(null)}
          >
            <div
              className="squircle flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_60px_-20px_rgba(20,25,60,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{previewing.subject}</p>
                  <p className="truncate text-xs text-gray-400">
                    À {previewing.toEmail} · {previewing.template}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewing(null)}
                  className="squircle shrink-0 rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <iframe
                  srcDoc={previewing.html}
                  title={previewing.subject}
                  sandbox=""
                  className="h-[70vh] w-full rounded-lg border-0 bg-white"
                />
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
    </div>
  )
}

export default StaffEmailsPage
