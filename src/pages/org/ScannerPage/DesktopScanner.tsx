import { motion } from 'framer-motion'
import { RotateCcw, ScanLine, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { OrderScanPanel } from './OrderScanPanel'
import { BottomSheet } from './BottomSheet'
import { HistorySheet } from './HistorySheet'
import { ResultIcon, resultBg } from './resultDisplay'
import type { SharedProps } from './types'

// ---------------------------------------------------------------------
// Desktop (>= 768px) — usage secondaire (guichet) : plus de largeur,
// viseur et résultat côte à côte au lieu de s'empiler (voir Scanner
// Terrain.dc.html, écran 09).
// ---------------------------------------------------------------------
export function DesktopScanner(p: SharedProps) {
  const {
    scannableServices,
    serviceId,
    setServiceId,
    currentServiceName,
    code,
    setCode,
    scanning,
    lastResult,
    resetting,
    orderResult,
    justScannedTicketId,
    pendingGroup,
    openGroupPanel,
    validatingAll,
    validatingTicketId,
    validateOrderTicket,
    validateAllOrderTickets,
    dismissResults,
    handleResetTicket,
    handleManualSubmit,
    qrScanner,
    validToday,
    historyOpen,
    setHistoryOpen,
    history,
    historyFailed,
    showHistoryLoading,
    setReloadKey,
  } = p

  return (
    <div className="relative" style={{ fontFamily: 'var(--font-public)' }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          icon={<ScanLine size={20} />}
          title="Scanner"
          subtitle={`${currentServiceName} · ${validToday} validés aujourd'hui`}
        />
        <div className="flex gap-2">
          {scannableServices.length > 1 && (
            <select
              value={serviceId ?? ''}
              onChange={(e) => setServiceId(Number(e.target.value))}
              className="squircle h-10 rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700"
            >
              {scannableServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="squircle flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700"
          >
            <RotateCcw size={14} />
            Derniers scans
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="squircle relative aspect-square overflow-hidden rounded-[22px] bg-[#0a0d18]">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 30%, oklch(0.32 0.02 250) 0%, oklch(0.15 0.015 260) 60%, #05070d 100%)',
            }}
          />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={qrScanner.videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
          <canvas ref={qrScanner.canvasRef} className="hidden" />
          {!qrScanner.cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative h-[200px] w-[200px]">
                <div className="absolute top-0 left-0 h-11 w-11 rounded-tl-2xl border-t-4 border-l-4 border-white" />
                <div className="absolute top-0 right-0 h-11 w-11 rounded-tr-2xl border-t-4 border-r-4 border-white" />
                <div className="absolute bottom-0 left-0 h-11 w-11 rounded-bl-2xl border-b-4 border-l-4 border-white" />
                <div className="absolute right-0 bottom-0 h-11 w-11 rounded-br-2xl border-r-4 border-b-4 border-white" />
              </div>
              <p className="text-[13px] font-semibold text-white/80">Présentez le QR du billet</p>
            </div>
          )}
          {qrScanner.cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
              {qrScanner.cameraError}
            </div>
          )}
          {orderResult && (
            <BottomSheet open onClose={dismissResults} maxHeight="92%">
              <OrderScanPanel
                orderResult={orderResult}
                justScannedTicketId={justScannedTicketId}
                validatingAll={validatingAll}
                validatingTicketId={validatingTicketId}
                onValidateTicket={validateOrderTicket}
                onValidateAll={validateAllOrderTickets}
                onDismiss={dismissResults}
              />
            </BottomSheet>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {lastResult ? (
            <div className="squircle flex flex-col gap-3.5 rounded-[22px] p-6" style={{ background: resultBg(lastResult.kind) }}>
              <div className="flex items-center gap-3.5">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex h-14 w-14 shrink-0 items-center justify-center squircle rounded-[18px] bg-white"
                  style={{ color: resultBg(lastResult.kind) }}
                >
                  <ResultIcon kind={lastResult.kind} />
                </motion.div>
                <p className="text-[26px] leading-[1.1] font-black tracking-tight text-white uppercase">
                  {lastResult.kind === 'valid' && (
                    <>
                      Entrée
                      <br />
                      autorisée
                    </>
                  )}
                  {lastResult.kind === 'already' && (
                    <>
                      Déjà
                      <br />
                      scanné
                    </>
                  )}
                  {lastResult.kind === 'refused' && (
                    <>
                      Entrée
                      <br />
                      refusée
                    </>
                  )}
                </p>
              </div>
              <div className="h-px bg-white/22" />
              {lastResult.kind === 'valid' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">{lastResult.tariffType}</p>
                  <p className="text-[13.5px] font-semibold text-white/85">
                    {lastResult.visitLabel}
                    {lastResult.ticketRef && ` · ${lastResult.ticketRef}`}
                  </p>
                </div>
              )}
              {lastResult.kind === 'already' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">
                    {lastResult.tariffType} · {lastResult.visitLabel}
                  </p>
                  {lastResult.consumedLabel && (
                    <p className="text-[13.5px] font-semibold text-white/85">{lastResult.consumedLabel}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResetTicket(lastResult.ticketId)}
                    disabled={resetting}
                    className="mt-2 flex h-11 items-center justify-center gap-2 squircle rounded-[14px] border-2 border-white/85 text-[14px] font-bold text-white disabled:opacity-70"
                  >
                    <RotateCcw size={15} />
                    {resetting ? 'Remise en cours…' : "Ré-autoriser l'entrée"}
                  </button>
                </div>
              )}
              {lastResult.kind === 'refused' && (
                <div className="flex flex-col gap-1">
                  <p className="text-[18px] font-extrabold text-white">{lastResult.title}</p>
                  {lastResult.subtitle && <p className="text-[13.5px] font-semibold text-white/85">{lastResult.subtitle}</p>}
                </div>
              )}
              {pendingGroup && (
                <button
                  type="button"
                  onClick={openGroupPanel}
                  className="flex h-11 items-center justify-center gap-2 squircle rounded-[14px] border-2 border-white/40 text-[14px] font-bold text-white"
                >
                  <Users size={15} />
                  Voir les {pendingGroup.tickets.length - 1} autres billets de la commande
                </button>
              )}
              <button
                type="button"
                onClick={dismissResults}
                className="flex h-11 items-center justify-center gap-2 squircle rounded-[14px] bg-white text-[14px] font-bold"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ScanLine size={15} />
                Scanner le suivant
              </button>
            </div>
          ) : (
            <div className="squircle flex items-center gap-2 rounded-[22px] bg-gray-100 p-6 text-sm text-gray-400">
              En attente d'un scan…
            </div>
          )}

          <div className="squircle flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-gray-200 bg-white p-[18px]">
            <p className="text-[13.5px] font-bold text-gray-700">Saisie manuelle</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleManualSubmit()
              }}
              className="flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code du billet…"
                className="h-11 flex-1 squircle rounded-xl border-[1.5px] border-gray-200 px-3.5 font-mono text-[15px] text-gray-700 outline-none focus:border-aregie-deep"
              />
              <button
                type="submit"
                disabled={scanning || !code.trim()}
                className="h-11 shrink-0 squircle rounded-xl bg-aregie-deep px-[18px] text-[14px] font-bold text-white disabled:opacity-50"
              >
                Vérifier
              </button>
            </form>
          </div>
        </div>
      </div>

      <HistorySheet
        open={historyOpen}
        serviceName={currentServiceName}
        entries={history}
        failed={historyFailed}
        loading={showHistoryLoading}
        onClose={() => setHistoryOpen(false)}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    </div>
  )
}
