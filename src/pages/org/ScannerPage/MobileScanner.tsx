import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChevronDown, Flashlight, Keyboard, RotateCcw, ScanLine, Users } from 'lucide-react'
import { OrderScanPanel } from './OrderScanPanel'
import { BottomSheet } from './BottomSheet'
import { ManualEntrySheet } from './ManualEntrySheet'
import { HistorySheet } from './HistorySheet'
import { ServicePickerSheet } from './ServicePickerSheet'
import { ResultIcon, resultBg } from './resultDisplay'
import type { SharedProps } from './types'

// ---------------------------------------------------------------------
// Mobile — plein écran immersif : le résultat prend tout l'écran en
// couleur pleine, tout ce qui n'est pas le scan est un panneau
// escamotable, chaque action utile est dans le pouce (voir Scanner
// Terrain.dc.html, écrans 01 à 08).
// ---------------------------------------------------------------------
export function MobileScanner(p: SharedProps) {
  const {
    scannableServices,
    serviceId,
    setServiceId,
    currentServiceName,
    mode,
    setMode,
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
    scansToday,
    historyOpen,
    setHistoryOpen,
    servicePickerOpen,
    setServicePickerOpen,
    history,
    historyFailed,
    showHistoryLoading,
    setReloadKey,
  } = p

  return (
    <div
      className="absolute inset-0 overflow-hidden overscroll-contain bg-[#0a0d18]"
      style={{ fontFamily: 'var(--font-public)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 30%, oklch(0.35 0.02 250) 0%, oklch(0.16 0.015 260) 60%, #05070d 100%)',
        }}
      />
      {mode === 'camera' && !lastResult && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[.16]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.5) 22px 23px)',
          }}
        />
      )}

      {mode === 'camera' && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={qrScanner.videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
          <canvas ref={qrScanner.canvasRef} className="hidden" />
        </>
      )}

      {!lastResult && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => scannableServices.length > 1 && setServicePickerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[16px] border border-white/16 bg-[#0a0d18]/62 px-4 py-3 text-left backdrop-blur-md"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#3ddc84] shadow-[0_0_0_4px_rgba(61,220,132,.22)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold leading-tight text-white">
                {currentServiceName}
              </span>
              {scannableServices.length > 1 && (
                <span className="block text-[11.5px] font-medium text-white/60">
                  Service scanné · appuyer pour changer
                </span>
              )}
            </span>
            {scannableServices.length > 1 && <ChevronDown size={15} className="shrink-0 text-white/70" />}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] border border-white/16 bg-[#0a0d18]/62 text-white backdrop-blur-md"
            aria-label="Derniers scans"
          >
            <RotateCcw size={19} />
            {scansToday > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-[#0a0d18] bg-aregie-blue px-1 text-[10.5px] font-bold text-white">
                {scansToday}
              </span>
            )}
          </button>
        </div>
      )}

      {mode === 'camera' && !lastResult && !orderResult && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
          <div className="relative h-[268px] w-[268px]">
            <div className="absolute top-0 left-0 h-14 w-14 rounded-tl-[20px] border-t-[5px] border-l-[5px] border-white" />
            <div className="absolute top-0 right-0 h-14 w-14 rounded-tr-[20px] border-t-[5px] border-r-[5px] border-white" />
            <div className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-[20px] border-b-[5px] border-l-[5px] border-white" />
            <div className="absolute right-0 bottom-0 h-14 w-14 rounded-br-[20px] border-r-[5px] border-b-[5px] border-white" />
          </div>
          {!qrScanner.cameraError && !scanning && (
            <p className="max-w-[250px] text-center text-[15.5px] font-semibold text-white/90">
              Présentez le QR du billet
              <br />
              <span className="font-medium text-white/55">La validation part toute seule</span>
            </p>
          )}
          {scanning && <p className="text-[15.5px] font-semibold text-white/90">Vérification…</p>}
        </div>
      )}

      {qrScanner.cameraError && mode === 'camera' && !lastResult && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
          {qrScanner.cameraError}
        </div>
      )}

      {!lastResult && mode === 'camera' && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between px-1.5 text-[12.5px] font-semibold text-white/60">
            <span>
              <span className="font-extrabold text-[#3ddc84]">{validToday}</span> validés aujourd'hui
            </span>
            {qrScanner.torchSupported && (
              <button
                type="button"
                onClick={qrScanner.toggleTorch}
                className={`flex items-center gap-1.5 ${qrScanner.torchOn ? 'text-white' : 'text-white/60'}`}
              >
                <Flashlight size={14} />
                Torche
              </button>
            )}
          </div>
          <div className="flex gap-1.5 rounded-[20px] border border-white/14 bg-white/10 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('camera')}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[15px] bg-white text-[15.5px] font-bold text-[#131a33]"
            >
              <Camera size={17} />
              Caméra
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[15px] text-[15.5px] font-semibold text-white/82"
            >
              <Keyboard size={17} />
              Code
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {lastResult && (
          <motion.div
            key={lastResult.kind}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 flex flex-col overflow-y-auto overscroll-contain"
            style={{ background: resultBg(lastResult.kind) }}
          >
            <p className="shrink-0 pt-[max(12px,env(safe-area-inset-top))] text-center text-[12.5px] font-semibold text-white/70">
              {currentServiceName}
            </p>

            <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-4">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-[34px] bg-white"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ResultIcon kind={lastResult.kind} />
              </motion.div>

              {lastResult.kind === 'valid' && (
                <p className="shrink-0 text-center text-[32px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Entrée
                  <br />
                  autorisée
                </p>
              )}
              {lastResult.kind === 'already' && (
                <p className="shrink-0 text-center text-[30px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Déjà
                  <br />
                  scanné
                </p>
              )}
              {lastResult.kind === 'refused' && (
                <p className="shrink-0 text-center text-[32px] leading-[1.05] font-black tracking-tight text-white uppercase">
                  Entrée
                  <br />
                  refusée
                </p>
              )}

              {lastResult.kind === 'valid' && (
                <div className="flex w-full shrink-0 flex-col gap-2.5 rounded-[20px] border border-white/22 bg-white/14 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-white/72">Tarif</span>
                    <span className="text-[20px] font-extrabold text-white">{lastResult.tariffType}</span>
                  </div>
                  <div className="h-px bg-white/20" />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-white/72">Visite</span>
                    <span className="text-[16px] font-bold text-white">{lastResult.visitLabel}</span>
                  </div>
                  {lastResult.ticketRef && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-white/72">Billet</span>
                      <span className="font-mono text-[14px] font-semibold text-white/90">{lastResult.ticketRef}</span>
                    </div>
                  )}
                </div>
              )}

              {lastResult.kind === 'already' && (
                <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-[18px] border border-white/22 bg-white/14 px-4 py-3.5">
                  <p className="text-[18px] font-extrabold text-white">
                    {lastResult.tariffType} · {lastResult.visitLabel}
                  </p>
                  {lastResult.consumedLabel && (
                    <p className="text-[13.5px] font-semibold text-white/82">{lastResult.consumedLabel}</p>
                  )}
                </div>
              )}

              {lastResult.kind === 'refused' && (
                <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-[20px] border border-white/22 bg-white/14 px-5 py-4">
                  <p className="text-[20px] font-extrabold text-white">{lastResult.title}</p>
                  {lastResult.subtitle && <p className="text-[14.5px] font-semibold text-white/85">{lastResult.subtitle}</p>}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {lastResult.kind === 'already' && (
                <div className="flex flex-col gap-2 rounded-[18px] bg-black/16 px-4 pt-3 pb-3.5">
                  <p className="text-[12.5px] font-medium text-white/80">
                    Le visiteur est sorti puis revenu ? Remettez le billet en attente de scan.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleResetTicket(lastResult.ticketId)}
                    disabled={resetting}
                    className="flex h-[50px] items-center justify-center gap-2 rounded-[15px] border-2 border-white/85 text-[15px] font-bold text-white disabled:opacity-70"
                  >
                    <RotateCcw size={16} />
                    {resetting ? 'Remise en cours…' : "Ré-autoriser l'entrée"}
                  </button>
                </div>
              )}
              {pendingGroup && (
                <button
                  type="button"
                  onClick={openGroupPanel}
                  className="flex h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-white/40 text-[15px] font-bold text-white"
                >
                  <Users size={16} />
                  Voir les {pendingGroup.tickets.length - 1} autres billets de la commande
                </button>
              )}
              <button
                type="button"
                onClick={dismissResults}
                className="flex h-14 items-center justify-center gap-2.5 rounded-[19px] bg-white text-[16.5px] font-extrabold"
                style={{ color: resultBg(lastResult.kind) }}
              >
                <ScanLine size={16} />
                Scanner le suivant
              </button>
              {lastResult.kind === 'valid' && !pendingGroup && (
                <p className="text-center text-[12.5px] font-medium text-white/68">Retour au viseur dans 2 s</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ManualEntrySheet
        open={mode === 'manual' && !lastResult}
        code={code}
        submitting={scanning}
        onChange={setCode}
        onSubmit={handleManualSubmit}
        onCancel={() => setMode('camera')}
      />

      <BottomSheet open={!!orderResult} onClose={dismissResults} maxHeight="88%">
        {orderResult && (
          <OrderScanPanel
            orderResult={orderResult}
            justScannedTicketId={justScannedTicketId}
            validatingAll={validatingAll}
            validatingTicketId={validatingTicketId}
            onValidateTicket={validateOrderTicket}
            onValidateAll={validateAllOrderTickets}
            onDismiss={dismissResults}
          />
        )}
      </BottomSheet>

      <HistorySheet
        open={historyOpen}
        serviceName={currentServiceName}
        entries={history}
        failed={historyFailed}
        loading={showHistoryLoading}
        onClose={() => setHistoryOpen(false)}
        onRetry={() => setReloadKey((k) => k + 1)}
      />

      <ServicePickerSheet
        open={servicePickerOpen}
        services={scannableServices}
        selectedId={serviceId}
        countByService={(id) => (id === serviceId ? validToday : null)}
        onClose={() => setServicePickerOpen(false)}
        onSelect={(id) => {
          setServiceId(id)
          setServicePickerOpen(false)
        }}
      />
    </div>
  )
}
