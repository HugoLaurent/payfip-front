import { useState } from 'react'
import { Download, Search, UserCheck } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useStaffOrgOptions } from '@/lib/useStaffOrgOptions'
import { useToast } from '@/lib/useToast'
import { downloadCsv } from '@/lib/exportCsv'
import {
  Card,
  DangerButton,
  EmptyState,
  HeroGhostButton,
  LoadError,
  Modal,
  Pagination,
  SecondaryButton,
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
  const { showToast } = useToast()
  const orgs = useStaffOrgOptions()
  const [orgId, setOrgId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StaffRegistration | null>(null)
  const [attempts, setAttempts] = useState<PaymentAttempt[] | null>(null)
  const [attemptsFailed, setAttemptsFailed] = useState(false)
  const [acting, setActing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const {
    data: registrations,
    meta,
    loadFailed,
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

  async function review(decision: 'approve' | 'reject') {
    if (!selected) return
    setActing(true)
    const result = await apiCall(
      'POST',
      `/staff/registrations/${selected.id}/review?serviceId=${selected.serviceId}`,
      { staffToken, body: { decision } }
    )
    setActing(false)
    if (result.ok) {
      showToast('success', decision === 'approve' ? 'Inscription validée' : 'Inscription rejetée', selected.registrationReference)
      setSelected(null)
      reload()
    } else {
      showToast('error', 'Échec', "Impossible de traiter l'inscription.")
    }
  }

  async function resendReminder() {
    if (!selected) return
    setActing(true)
    const result = await apiCall(
      'POST',
      `/staff/registrations/${selected.id}/resend-reminder?serviceId=${selected.serviceId}`,
      { staffToken }
    )
    setActing(false)
    if (result.ok) {
      showToast('success', 'Relance envoyée', selected.registrationReference)
    } else {
      showToast('error', 'Échec', 'Impossible de relancer.')
    }
  }

  async function cancelRegistration() {
    if (!selected) return
    setActing(true)
    const result = await apiCall(
      'POST',
      `/staff/registrations/${selected.id}/cancel?serviceId=${selected.serviceId}`,
      { staffToken }
    )
    setActing(false)
    setShowCancelConfirm(false)
    if (result.ok) {
      showToast('success', 'Inscription annulée', selected.registrationReference)
      setSelected(null)
      reload()
    } else {
      showToast('error', 'Échec', "Impossible d'annuler l'inscription.")
    }
  }

  function exportCsv() {
    downloadCsv(
      'inscriptions.csv',
      ['Référence', 'Nom', 'Email', 'Montant', 'Statut', 'Date'],
      (registrations ?? []).map((r) => [
        r.registrationReference,
        `${r.firstName} ${r.lastName}`,
        r.email,
        euros(r.amountCents),
        r.status,
        new Date(r.createdAt).toLocaleDateString('fr-FR'),
      ])
    )
  }

  return (
    <div>
      <StaffHero
        icon={<UserCheck size={13} />}
        eyebrow="Par organisme"
        title="Inscriptions"
        actions={
          <HeroGhostButton type="button" onClick={exportCsv} disabled={!registrations || registrations.length === 0}>
            <Download size={14} />
            Exporter
          </HeroGhostButton>
        }
        stats={
          orgId !== ''
            ? [{ label: 'Inscriptions', value: meta ? String(meta.total) : null, icon: <UserCheck size={14} />, tone: 'blue' }]
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
            placeholder="Nom, email ou référence…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
      </Card>

      {orgId === '' && (
        <EmptyState icon={<UserCheck size={28} />} label="Choisissez un organisme pour voir ses inscriptions." />
      )}
      {orgId !== '' && loadFailed && <LoadError onRetry={reload} />}
      {orgId !== '' && !loadFailed && registrations === null && <StaffTableSkeleton columns={5} toolbar={false} />}
      {orgId !== '' && !loadFailed && registrations?.length === 0 && (
        <EmptyState icon={<UserCheck size={28} />} label="Aucune inscription." />
      )}

      {orgId !== '' && !loadFailed && registrations && registrations.length > 0 && (
        <StaffTable
          headers={['Référence', 'Nom', 'Montant', 'Statut', 'Date']}
          footer={
            meta && meta.lastPage > 1 ? (
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            ) : (
              <p className="text-xs text-gray-400">{meta?.total ?? registrations.length} inscription{(meta?.total ?? registrations.length) > 1 ? 's' : ''}</p>
            )
          }
        >
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
      )}

      {selected && !showCancelConfirm && (
        <Modal title="Inscription" onClose={() => setSelected(null)}>
          <p className="mb-1 font-mono text-xs text-gray-500">{selected.registrationReference}</p>
          <p className="mb-3 text-sm text-gray-600">
            {selected.firstName} {selected.lastName} — {selected.email}
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {selected.status === 'awaiting_review' && (
              <>
                <SecondaryButton type="button" onClick={() => review('approve')} disabled={acting}>
                  {acting ? '…' : 'Valider'}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => review('reject')} disabled={acting}>
                  {acting ? '…' : 'Rejeter'}
                </DangerButton>
              </>
            )}
            {(selected.status === 'awaiting_payment' || selected.status === 'rejected') && (
              <SecondaryButton type="button" onClick={resendReminder} disabled={acting}>
                {acting ? '…' : 'Relancer par email'}
              </SecondaryButton>
            )}
            {!['cancelled', 'expired'].includes(selected.status) && (
              <DangerButton type="button" onClick={() => setShowCancelConfirm(true)} disabled={acting}>
                Annuler l'inscription
              </DangerButton>
            )}
          </div>

          <p className="mb-2 text-xs font-medium text-gray-500">Tentatives de paiement</p>
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

      {selected && showCancelConfirm && (
        <Modal title="Annuler l'inscription" onClose={() => setShowCancelConfirm(false)}>
          <p className="mb-4 text-sm text-gray-600">
            <strong>{selected.registrationReference}</strong> ({selected.firstName} {selected.lastName})
            sera annulée. Aucun email n'est envoyé au citoyen (comme une annulation par l'agent).
          </p>
          <div className="flex gap-2">
            <DangerButton type="button" onClick={cancelRegistration} disabled={acting} className="flex-1 justify-center py-2">
              {acting ? 'Annulation…' : 'Confirmer'}
            </DangerButton>
            <SecondaryButton type="button" onClick={() => setShowCancelConfirm(false)} className="flex-1 justify-center">
              Retour
            </SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default StaffRegistrationsPage
