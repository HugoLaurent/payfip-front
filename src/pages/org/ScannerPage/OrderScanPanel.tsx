import { CheckSquare, Loader2, ScanLine, Ticket as TicketIcon } from 'lucide-react'

export interface OrderScanTicket {
  id: number
  tariffType: string
  visitDate: string
  status: string
  code: string
  consumedAt: string | null
}

export interface OrderScanResult {
  orderId: number
  paymentReference: string | null
  tickets: OrderScanTicket[]
}

function formatVisitDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Panneau affiché après le scan d'un QR de commande (regroupe tous les
// billets) — posé sur le viseur, celui-ci reste visible derrière (voir
// Scanner Terrain.dc.html, écran 05). Utilisé à la fois en overlay
// caméra et sous le champ de saisie manuelle, d'où l'extraction pour ne
// pas dupliquer la logique des boutons "Valider"/"Valider tout".
export function OrderScanPanel({
  orderResult,
  justScannedTicketId,
  validatingAll,
  validatingTicketId,
  onValidateTicket,
  onValidateAll,
  onDismiss,
  hideDismiss = false,
}: {
  orderResult: OrderScanResult
  // Le billet dont le scan individuel a fait apparaître ce panneau (famille/
  // groupe) — distingué en tête, séparé des autres, pour que l'agent
  // retrouve immédiatement "celui que je viens de faire passer" sans le
  // chercher dans la liste. Absent lors d'un scan direct du QR de commande
  // (aucun billet précis n'a été individuellement scanné).
  justScannedTicketId?: number | null
  validatingAll: boolean
  validatingTicketId: number | null
  onValidateTicket: (ticket: OrderScanTicket) => void
  onValidateAll: () => void
  onDismiss: () => void
  // Masque le bouton "Repasser au scan" propre au panneau — utilisé quand
  // il est affiché sous le résultat d'un scan de billet individuel
  // (famille/groupe), où c'est CE résultat-là qui porte déjà le bouton.
  hideDismiss?: boolean
}) {
  const justScanned = orderResult.tickets.find((t) => t.id === justScannedTicketId) ?? null
  const toValidate = orderResult.tickets.filter((t) => t.status === 'issued')
  const alreadyValidated = orderResult.tickets.filter(
    (t) => t.status === 'consumed' && t.id !== justScannedTicketId
  )

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center squircle rounded-[15px] bg-aregie-deep/10 text-aregie-deep">
          <TicketIcon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[19px] font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
            Commande {orderResult.tickets.length > 1 ? 'groupée' : ''}
          </p>
          <p className="text-[13px] font-medium text-gray-500">
            {orderResult.paymentReference ?? orderResult.orderId} · {orderResult.tickets.length} billet
            {orderResult.tickets.length > 1 ? 's' : ''}
            {alreadyValidated.length + (justScanned ? 1 : 0) > 0
              ? ` · ${alreadyValidated.length + (justScanned ? 1 : 0)} déjà validé${alreadyValidated.length + (justScanned ? 1 : 0) > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
      </div>

      {justScanned && (
        <div className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-[#03713d]/30 bg-[#03713d]/8 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center squircle rounded-[10px] bg-[#03713d] text-[14px] font-black text-white">
            ✓
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-[#03713d]">{justScanned.tariffType}</p>
            <p className="text-xs font-semibold text-[#03713d]/75">
              Billet que vous venez de scanner
              {justScanned.consumedAt ? ` · ${formatTime(justScanned.consumedAt)}` : ''}
            </p>
          </div>
        </div>
      )}

      {toValidate.length > 1 && (
        <button
          type="button"
          onClick={onValidateAll}
          disabled={validatingAll}
          className="flex h-[60px] shrink-0 items-center justify-center gap-2.5 squircle rounded-[18px] bg-aregie-deep text-[17px] font-extrabold text-white transition disabled:opacity-60"
        >
          {validatingAll ? <Loader2 size={17} className="animate-spin" /> : <CheckSquare size={17} />}
          {validatingAll ? 'Validation en cours…' : `Valider les ${toValidate.length} restants`}
        </button>
      )}

      {toValidate.length > 0 && (
        <div className="flex flex-col gap-2">
          {toValidate.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-[oklch(0.91_0.008_260)] bg-[oklch(0.975_0.004_260)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-gray-900">{t.tariffType}</p>
                <p className="text-xs font-medium text-gray-500">Visite du {formatVisitDate(t.visitDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => onValidateTicket(t)}
                disabled={validatingAll || validatingTicketId === t.id}
                className="flex h-[46px] shrink-0 items-center squircle rounded-[14px] bg-aregie-deep px-5 text-[15px] font-bold text-white transition disabled:opacity-60"
              >
                {validatingTicketId === t.id ? <Loader2 size={15} className="animate-spin" /> : 'Valider'}
              </button>
            </div>
          ))}
        </div>
      )}

      {alreadyValidated.length > 0 && (
        <div className="flex flex-col gap-2">
          {toValidate.length > 0 && (
            <p className="px-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">Déjà validés</p>
          )}
          {alreadyValidated.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-[oklch(0.82_0.06_150)] bg-[oklch(0.965_0.02_150)] px-4 py-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center squircle rounded-[9px] bg-[#03713d] text-[13px] font-black text-white">
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-[oklch(0.42_0.06_155)] line-through decoration-[oklch(0.72_0.05_155)]">
                  {t.tariffType}
                </p>
                <p className="text-xs font-semibold text-[oklch(0.45_0.07_155)]">
                  Déjà validé{t.consumedAt ? ` · ${formatTime(t.consumedAt)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hideDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-14 shrink-0 items-center justify-center gap-2 squircle rounded-[18px] border-2 border-gray-200 text-[16px] font-bold text-gray-700"
        >
          <ScanLine size={16} />
          Repasser au scan
        </button>
      )}
    </>
  )
}
