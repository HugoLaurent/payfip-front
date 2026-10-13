import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Check, Search, X } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
import {
  DangerButton,
  EmptyState,
  LoadError,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StatusBadge,
  TextInput,
  Textarea,
} from '@/components/ui'
import type { AuthState, EventAgent, PageMeta, RegistrationAgent } from '@/lib/types'

const STATUS_LABELS: Record<RegistrationAgent['status'], string> = {
  waitlisted: "Liste d'attente",
  awaiting_review: 'À vérifier',
  rejected: 'Rejeté',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  expired: 'Expiré',
}

const STATUS_TINTS: Record<RegistrationAgent['status'], string> = {
  waitlisted: 'bg-blue-50 text-blue-700',
  awaiting_review: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  awaiting_payment: 'bg-orange-50 text-orange-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
}

type Variant = 'panel' | 'sheet'

// Résumé des inscrits d'un évènement (statut, contact, état de la revue
// documentaire). Deux habillages pour le même contenu/logique : `panel`
// s'intègre en colonne de détail du maître-détail desktop (EventsManager,
// pas de portail — reste dans le flux normal de la grille), `sheet` devient
// un écran mobile plein écran par-dessus tout (portail vers document.body,
// comme Modal.tsx, pour échapper au containing block que crée l'animation
// d'entrée de page dans OrgSpace dès qu'un ancêtre porte un `transform`).
export function EventRegistrationsPanel({
  auth,
  event,
  variant,
  onClose,
  onRegistrationsChanged,
}: {
  auth: AuthState
  event: EventAgent
  variant: Variant
  onClose: () => void
  // Prévient EventsManager qu'un compteur affiché sur la carte évènement
  // (pendingReviewCount, registeredCount) a pu changer, pour qu'il
  // recharge sa liste — sinon ces compteurs restent périmés jusqu'à ce
  // que l'agent quitte et rouvre le panneau.
  onRegistrationsChanged?: () => void
}) {
  const { showToast } = useToast()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [reviewing, setReviewing] = useState<RegistrationAgent | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  // Pièces cochées "reçue et conforme" par l'agent pour l'inscription en
  // cours de revue — état local uniquement, jamais envoyé au serveur : sert
  // juste à empêcher un clic sur "Valider" avant d'avoir vraiment contrôlé
  // chaque pièce reçue par email (voir openReview, qui le réinitialise à
  // chaque ouverture). Les clés sont celles de event.documentRequirements.
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set())
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const { data, meta, loadFailed, showLoading, reload } = usePaginatedResource<RegistrationAgent, PageMeta>({
    fetcher: () =>
      apiCall<{ data: RegistrationAgent[]; meta: PageMeta }>(
        'GET',
        `/inscription/events/${event.id}/registrations?page=${page}&serviceId=${event.serviceId}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
        { token: auth.token },
      ),
    deps: [event.id, status, q, page],
  })

  function openReview(r: RegistrationAgent) {
    setReviewing(r)
    setRejectionReason('')
    setCheckedKeys(new Set())
  }

  function toggleChecked(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleReview(decision: 'approve' | 'reject' | 'request_more_documents' | 'revert') {
    if (!reviewing) return
    if ((decision === 'reject' || decision === 'request_more_documents') && !rejectionReason.trim()) return

    setSubmittingReview(true)
    const result = await apiCall('POST', `/inscription/registrations/${reviewing.id}/review?serviceId=${event.serviceId}`, {
      token: auth.token,
      body: decision === 'approve' || decision === 'revert' ? { decision } : { decision, rejectionReason: rejectionReason.trim() },
    })
    setSubmittingReview(false)

    if (result.ok) {
      const successLabel =
        decision === 'approve'
          ? 'Pièces validées'
          : decision === 'reject'
            ? 'Inscription rejetée'
            : decision === 'revert'
              ? 'Validation annulée'
              : 'Complément demandé'
      showToast('success', successLabel, `${reviewing.firstName} ${reviewing.lastName}`)
      setReviewing(null)
      setRejectionReason('')
      setCheckedKeys(new Set())
      await reload()
      onRegistrationsChanged?.()
    } else {
      showToast('error', 'Échec', "Impossible d'enregistrer la décision.")
    }
  }

  // Relance manuelle (le citoyen a le mail attendu — paiement ou renvoi de pièces —
  // mais tarde à agir) : renvoie le même email, sans changer le statut. Le
  // serveur applique un délai anti-spam entre deux relances (429).
  async function handleResendReminder(r: RegistrationAgent) {
    setResendingId(r.id)
    const result = await apiCall('POST', `/inscription/registrations/${r.id}/resend-reminder?serviceId=${event.serviceId}`, { token: auth.token })
    setResendingId(null)

    if (result.ok) {
      showToast('success', 'Relance envoyée', `${r.firstName} ${r.lastName}`)
    } else if (result.status === 429) {
      showToast('error', 'Trop tôt', 'Une relance a déjà été envoyée récemment pour cette inscription.')
    } else {
      showToast('error', 'Échec', "Impossible d'envoyer la relance.")
    }
  }

  // Annulation côté agent (l'inscrit a demandé par un autre canal, ou
  // no-show à retirer) — même endpoint que l'auto-annulation citoyen, pas
  // de vérification de délai côté agent. Aucun email envoyé au citoyen.
  async function handleCancelRegistration(r: RegistrationAgent) {
    if (!window.confirm(`Annuler l'inscription de ${r.firstName} ${r.lastName} ? Cette action est irréversible.`)) {
      return
    }
    setCancellingId(r.id)
    const result = await apiCall('POST', `/inscription/registrations/${r.id}/cancel?serviceId=${event.serviceId}`, { token: auth.token })
    setCancellingId(null)

    if (result.ok) {
      showToast('success', 'Inscription annulée', `${r.firstName} ${r.lastName}`)
      await reload()
      onRegistrationsChanged?.()
    } else {
      showToast('error', 'Échec', "Impossible d'annuler l'inscription.")
    }
  }

  const isSheet = variant === 'sheet'

  const header = (
    <div className={`flex items-center gap-3 border-b border-gray-100 px-4 ${isSheet ? 'py-3' : 'py-4'}`}>
      {isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="squircle -ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
          aria-label="Retour à la liste des évènements"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
          Inscrits — {event.title}
        </h3>
        {meta && (
          <p className="text-xs text-gray-400">
            {meta.total} inscription(s)
            {event.pendingReviewCount > 0 && (
              <span className="font-semibold text-aregie-coral"> · {event.pendingReviewCount} à vérifier</span>
            )}
          </p>
        )}
      </div>
      {!isSheet && (
        <button
          type="button"
          onClick={onClose}
          className="squircle rounded-lg bg-gray-100 p-1.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )

  const filters = (
    <div className={`flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3`}>
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          type="text"
          placeholder="Nom, email, référence…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>
      <SelectInput
        value={status}
        onChange={(e) => {
          setStatus(e.target.value)
          setPage(1)
        }}
        className={isSheet ? 'w-full' : 'w-52'}
      >
        <option value="">Tous les statuts</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectInput>
    </div>
  )

  // Une ligne d'inscrit — tout le contenu se serre à gauche (`flex-wrap`
  // sans `flex-1`/`justify-between`, rien qui s'étire) au lieu d'écarter
  // nom/statut d'un côté et montant/actions de l'autre : un nom court
  // laissait sinon un grand vide au milieu de la ligne, quelle que soit la
  // largeur de la colonne de détail. Le nom tronque à 200px max ; email et
  // référence passent sur une seconde ligne (`w-full` force le retour dans
  // le flex-wrap) plutôt que de pousser le reste plus loin encore.
  function registrationRow(r: RegistrationAgent) {
    return (
      <div
        key={r.id}
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-2.5 ${isSheet ? '' : 'border-t border-gray-100 first:border-t-0'}`}
      >
        <p className="max-w-[200px] truncate text-sm font-semibold text-gray-900">
          {r.firstName} {r.lastName}
        </p>
        <StatusBadge label={STATUS_LABELS[r.status]} className={`${STATUS_TINTS[r.status]} px-2.5 py-1 text-xs`} />
        <span className="text-sm font-bold text-gray-900">{r.amountCents === 0 ? 'Gratuit' : euros(r.amountCents)}</span>
        {r.status === 'awaiting_review' && r.documentsSentAt && (
          <span
            className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
            title={`Déclaré le ${new Date(r.documentsSentAt).toLocaleString('fr-FR')}`}
          >
            ✉ Pièces envoyées
          </span>
        )}
        {r.status === 'awaiting_review' && (
          <PrimaryButton type="button" onClick={() => openReview(r)} className="shrink-0 px-3 py-1.5 text-xs">
            Vérifier
          </PrimaryButton>
        )}
        {r.status === 'rejected' && (
          <SecondaryButton type="button" onClick={() => openReview(r)} className="shrink-0 px-3 py-1.5 text-xs">
            Re-vérifier
          </SecondaryButton>
        )}
        {(r.status === 'awaiting_payment' || r.status === 'rejected') && (
          <SecondaryButton
            type="button"
            onClick={() => handleResendReminder(r)}
            disabled={resendingId === r.id}
            className="shrink-0 px-3 py-1.5 text-xs"
          >
            {resendingId === r.id ? '…' : 'Relancer'}
          </SecondaryButton>
        )}
        {r.status !== 'cancelled' && r.status !== 'expired' && (
          <DangerButton
            type="button"
            onClick={() => handleCancelRegistration(r)}
            disabled={cancellingId === r.id}
            className="shrink-0 px-3 py-1.5 text-xs"
          >
            {cancellingId === r.id ? '…' : 'Annuler'}
          </DangerButton>
        )}
        <p className="w-full truncate text-xs text-gray-400">
          {r.email} · {r.registrationReference}
          {r.quantity > 1 ? ` · ${r.quantity} participants` : ''}
        </p>
      </div>
    )
  }

  const list = (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {loadFailed && <LoadError onRetry={reload} />}
      {!loadFailed && showLoading && <p className="py-6 text-sm text-gray-500">Chargement…</p>}
      {!loadFailed && data?.length === 0 && <EmptyState label="Aucune inscription pour ce filtre." />}

      <div className="flex flex-col">{data?.map(registrationRow)}</div>

      {meta && <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} onChange={setPage} />}
    </div>
  )

  const content = (
    <div className={isSheet ? 'flex h-full flex-col' : 'flex h-full min-h-0 flex-col'}>
      {header}
      {filters}
      {list}
    </div>
  )

  // Une inscription déjà refusée peut être re-décidée : le citoyen a renvoyé
  // ses pièces par email, aucune action de sa part ne la repasse en revue.
  const requirements = event.documentRequirements ?? []
  const isPending = reviewing?.status === 'awaiting_review' || reviewing?.status === 'rejected'
  const allPiecesChecked = requirements.every((req) => !req.required || checkedKeys.has(req.key))
  const canRevert =
    reviewing?.status === 'awaiting_payment' || (reviewing?.status === 'confirmed' && reviewing.paymentMethod === 'free')

  const reviewBody = reviewing && (
    <>
      <div className="flex items-center gap-3">
        <div className="squircle flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aregie-tint/20 text-sm font-bold text-aregie-deep">
          {reviewing.firstName[0]?.toUpperCase()}
          {reviewing.lastName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            {reviewing.firstName} {reviewing.lastName}
          </h3>
          <p className="truncate text-xs text-gray-400">
            {reviewing.email} · {reviewing.registrationReference}
          </p>
        </div>
      </div>

      {requirements.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11.5px] font-semibold text-gray-500">
            Pièces attendues par email
            {isPending && <span className="ml-1 font-normal text-gray-400">— cochez chaque pièce reçue et conforme</span>}
          </p>
          <p className={`text-xs font-medium ${reviewing.documentsSentAt ? 'text-emerald-700' : 'text-gray-400'}`}>
            {reviewing.documentsSentAt
              ? `✉ Le citoyen a déclaré avoir envoyé ses pièces le ${new Date(reviewing.documentsSentAt).toLocaleString('fr-FR')}.`
              : "Le citoyen n'a pas encore déclaré avoir envoyé ses pièces."}
          </p>
          {event.documentContactEmail && (
            <p className="text-xs text-gray-400">
              Boîte à consulter : <span className="font-medium text-gray-600">{event.documentContactEmail}</span> — objet
              attendu : <span className="font-medium text-gray-600">Pièces {reviewing.registrationReference}</span>
            </p>
          )}
          <div className="space-y-1.5">
            {requirements.map((req) => {
              const checked = checkedKeys.has(req.key)
              return (
                <div key={req.key} className="squircle flex w-full items-center gap-2.5 rounded-xl border border-gray-200 px-3.5 py-2.5">
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => toggleChecked(req.key)}
                      aria-pressed={checked}
                      aria-label={`Marquer ${req.label} comme reçue et conforme`}
                      className={`squircle flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                        checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-gray-400'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {req.label}
                      {!req.required && <span className="ml-1 font-normal text-gray-400">(facultatif)</span>}
                    </p>
                    {req.instructions && <p className="truncate text-xs text-gray-400">{req.instructions}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isPending ? (
        <>
          <p className="mt-5 mb-3 text-sm text-gray-500">
            Valider les pièces reçues par email, demander une pièce en plus (les pièces déjà reçues restent
            valables), ou rejeter — le message est vu tel quel par le citoyen.
          </p>
          <label className="mb-1.5 block text-[11.5px] font-semibold text-gray-500">
            Message pour le citoyen
            {rejectionReason.trim() === '' && <span className="ml-1 font-normal text-gray-400">(obligatoire sauf pour valider)</span>}
          </label>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Ex. Le justificatif de domicile date de plus de 3 mois, merci d'en renvoyer un récent par email."
            rows={3}
            className="mb-4"
          />
          <div className={isSheet ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
            <PrimaryButton
              type="button"
              onClick={() => handleReview('approve')}
              disabled={submittingReview || !allPiecesChecked}
              title={!allPiecesChecked ? 'Cochez chaque pièce requise comme conforme avant de valider' : undefined}
              className={isSheet ? 'col-span-2 justify-center' : 'flex-1 justify-center'}
            >
              {submittingReview ? '…' : 'Valider les pièces'}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => handleReview('request_more_documents')}
              disabled={submittingReview || !rejectionReason.trim()}
              className={isSheet ? 'justify-center py-2.5' : 'flex-1 justify-center py-2.5'}
            >
              + de pièces
            </SecondaryButton>
            <DangerButton
              type="button"
              onClick={() => handleReview('reject')}
              disabled={submittingReview || !rejectionReason.trim()}
              className={isSheet ? 'justify-center py-2.5' : 'flex-1 justify-center py-2.5'}
            >
              Rejeter
            </DangerButton>
          </div>
          {!allPiecesChecked && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Cochez chaque pièce requise comme conforme pour activer la validation.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 mb-3">
          <p className="text-sm text-gray-500">
            Statut : <span className="font-semibold text-gray-700">{STATUS_LABELS[reviewing.status]}</span> — déjà traité.
          </p>
          {canRevert && (
            <SecondaryButton type="button" onClick={() => handleReview('revert')} disabled={submittingReview} className="mt-3 w-full justify-center">
              {submittingReview ? '…' : 'Annuler la validation (erreur ?)'}
            </SecondaryButton>
          )}
        </div>
      )}
      <SecondaryButton type="button" onClick={() => setReviewing(null)} className="mt-2 w-full justify-center">
        {isPending ? 'Annuler' : 'Fermer'}
      </SecondaryButton>
    </>
  )

  return (
    <>
      {isSheet ? (
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden" style={{ fontFamily: 'var(--font-public)' }}>
            {content}
          </div>,
          document.body,
        )
      ) : (
        content
      )}

      {reviewing &&
        (isSheet ? (
          // Fiche inscrit en tiroir bas plutôt qu'en modale centrée : les
          // actions (valider/rejeter) restent atteignables au pouce en bas
          // d'écran, comme le reste du parcours mobile de cet écran.
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed inset-0 z-[60] flex items-end bg-black/40"
              onClick={() => setReviewing(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="squircle max-h-[88vh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-20px_rgba(20,25,60,0.4)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
                {reviewBody}
              </motion.div>
            </motion.div>,
            document.body,
          )
        ) : (
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setReviewing(null)}
            >
              <div
                className="squircle w-full max-w-lg rounded-[22px] bg-white p-7 shadow-[0_30px_60px_-20px_rgba(20,25,60,0.4)]"
                onClick={(e) => e.stopPropagation()}
              >
                {reviewBody}
              </div>
            </motion.div>,
            document.body,
          )
        ))}
    </>
  )
}
