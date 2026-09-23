import { useEffect, useState } from 'react'
import { Download, Search, Settings, ShoppingCart } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useStaffAuth } from '@/lib/useStaffAuth'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useStaffOrgOptions } from '@/lib/useStaffOrgOptions'
import { useToast } from '@/lib/useToast'
import { downloadCsv } from '@/lib/exportCsv'
import {
  EmptyState,
  HeroButton,
  HeroGhostButton,
  LoadError,
  Modal,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  Textarea,
  TextInput,
} from '@/components/ui'
import { StaffHero } from '@/components/staff/StaffHero'
import { genericStatusTint, StaffRow, StaffTable, StaffTableSkeleton, Td } from '@/components/staff/StaffTable'
import type { PageMeta, ServiceRow } from '@/lib/types'

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
  const { showToast } = useToast()
  const orgs = useStaffOrgOptions()
  const [orgId, setOrgId] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const {
    data: orders,
    meta,
    loadFailed,
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

  // Outil "Gérer un billet" : un citoyen appelle avec son id de billet
  // (visible sur son PDF) — pas de recherche par liste ici, un lookup
  // direct suffit (resetScan/refund renvoient déjà le billet concerné).
  const [showTicketTool, setShowTicketTool] = useState(false)
  const [ticketServices, setTicketServices] = useState<ServiceRow[] | null>(null)
  const [ticketServiceId, setTicketServiceId] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [ticketActing, setTicketActing] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)

  useEffect(() => {
    if (!showTicketTool || !orgId) {
      setTicketServices(null)
      return
    }
    apiCall<{ data: ServiceRow[] }>('GET', `/staff/services?orgId=${orgId}&perPage=100`, { staffToken }).then(
      (result) => {
        if (result.ok) setTicketServices(result.data.data.filter((s) => s.serviceType === 'billetterie'))
      }
    )
  }, [showTicketTool, orgId, staffToken])

  function openTicketTool() {
    setTicketServiceId('')
    setTicketId('')
    setRefundReason('')
    setTicketError(null)
    setShowTicketTool(true)
  }

  async function handleResetScan() {
    if (!ticketServiceId || !ticketId) return
    setTicketActing(true)
    setTicketError(null)
    const result = await apiCall(
      'POST',
      `/staff/tickets/${ticketId}/reset-scan?serviceId=${ticketServiceId}`,
      { staffToken }
    )
    setTicketActing(false)
    if (result.ok) {
      showToast('success', 'Scan réinitialisé', `Billet #${ticketId}`)
      setShowTicketTool(false)
    } else if (result.status === 404) {
      setTicketError('Billet introuvable pour ce service.')
    } else if (result.status === 409) {
      setTicketError("Ce billet n'a pas encore été scanné.")
    } else {
      setTicketError('Échec de la réinitialisation.')
    }
  }

  async function handleRefundTicket() {
    if (!ticketServiceId || !ticketId || !refundReason.trim()) return
    setTicketActing(true)
    setTicketError(null)
    const result = await apiCall(
      'POST',
      `/staff/tickets/${ticketId}/refund?serviceId=${ticketServiceId}`,
      { staffToken, body: { reason: refundReason.trim() } }
    )
    setTicketActing(false)
    if (result.ok) {
      showToast('success', 'Billet marqué remboursé', `Billet #${ticketId}`)
      setShowTicketTool(false)
    } else if (result.status === 404) {
      setTicketError('Billet introuvable pour ce service.')
    } else if (result.status === 409) {
      setTicketError('Ce billet ne peut plus être remboursé (déjà remboursé ou statut invalide).')
    } else {
      setTicketError('Échec du remboursement.')
    }
  }

  function exportCsv() {
    downloadCsv(
      'commandes.csv',
      ['Référence', 'Email', 'Billets', 'Montant', 'Statut', 'Date'],
      (orders ?? []).map((o) => [
        o.paymentReference,
        o.email,
        o.qtyTickets,
        euros(o.totalAmountCents),
        o.status,
        new Date(o.createdAt).toLocaleDateString('fr-FR'),
      ])
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaffHero
        icon={<ShoppingCart size={13} />}
        eyebrow="Billetterie, par organisme"
        title="Commandes"
        actions={
          <>
            <HeroGhostButton type="button" onClick={exportCsv} disabled={!orders || orders.length === 0}>
              <Download size={14} />
              Exporter
            </HeroGhostButton>
            <HeroButton type="button" onClick={openTicketTool}>
              <Settings size={14} />
              Gérer un billet
            </HeroButton>
          </>
        }
        stats={
          orgId !== ''
            ? [{ label: 'Commandes', value: meta ? String(meta.total) : null, icon: <ShoppingCart size={14} />, tone: 'blue' }]
            : undefined
        }
        // Toujours visible, même sans organisme choisi ni données
        // chargées — c'est le seul moyen de choisir un organisme, il ne
        // peut pas être piégé dans le toolbar de StaffTable qui ne
        // s'affiche que lorsque des données existent déjà (bug corrigé
        // le 2026-09-23). StaffHero le fait flotter avec les stats sur
        // le même bloc par-dessus la bannière, comme dans la maquette.
        toolbar={
          <>
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
                placeholder="Référence ou email…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </>
        }
      />

      <div className="min-h-0 flex-1">
      {orgId === '' && <EmptyState icon={<ShoppingCart size={28} />} label="Choisissez un organisme pour voir ses commandes." />}
      {orgId !== '' && loadFailed && <LoadError onRetry={reload} />}
      {orgId !== '' && !loadFailed && orders === null && <StaffTableSkeleton columns={6} toolbar={false} />}
      {orgId !== '' && !loadFailed && orders?.length === 0 && (
        <EmptyState icon={<ShoppingCart size={28} />} label="Aucune commande." />
      )}

      {orgId !== '' && !loadFailed && orders && orders.length > 0 && (
        <StaffTable
          headers={['Référence', 'Email', 'Billets', 'Montant', 'Statut', 'Date']}
          footer={
            meta && meta.lastPage > 1 ? (
              <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />
            ) : (
              <p className="text-xs text-gray-400">{meta?.total ?? orders.length} commande{(meta?.total ?? orders.length) > 1 ? 's' : ''}</p>
            )
          }
        >
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
      )}
      </div>

      {showTicketTool && (
        <Modal title="Gérer un billet" onClose={() => setShowTicketTool(false)}>
          <div className="space-y-3">
            {orgId === '' ? (
              <p className="text-sm text-gray-500">
                Choisissez d'abord un organisme dans le filtre au-dessus de la liste des commandes.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Service (billetterie)</label>
                  <SelectInput value={ticketServiceId} onChange={(e) => setTicketServiceId(e.target.value)} required>
                    <option value="">Choisir…</option>
                    {ticketServices?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <TextInput
                  type="number"
                  placeholder="Id du billet (visible sur le PDF)"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  required
                />
                <Textarea
                  placeholder="Motif du remboursement (requis pour rembourser)"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                />
                {ticketError && <p className="text-sm text-red-600">{ticketError}</p>}
                <div className="flex gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={handleResetScan}
                    disabled={ticketActing || !ticketServiceId || !ticketId}
                    className="flex-1 justify-center py-2"
                  >
                    {ticketActing ? '…' : 'Réinitialiser le scan'}
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    onClick={handleRefundTicket}
                    disabled={ticketActing || !ticketServiceId || !ticketId || !refundReason.trim()}
                    className="flex-1 justify-center py-2"
                  >
                    {ticketActing ? '…' : 'Marquer remboursé'}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default StaffOrdersPage
