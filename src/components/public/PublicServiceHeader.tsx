import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { GATEWAY_URL } from '@/lib/api'
import { useSquircle } from '@/lib/useSquircle'
import type { ServiceLookup } from '@/lib/types'

// En-tête avec logo/nom du service — n'apparaît que sur l'écran
// "Billets" dans la maquette (les écrans email/confirmation n'ont pas de
// bandeau de marque, voir PublicPurchasePage/PurchaseReturnPage).
export function PublicServiceHeader({
  service,
  logoFailed,
  onLogoFail,
  onBack,
}: {
  service: ServiceLookup
  logoFailed?: boolean
  onLogoFail?: () => void
  // Optionnel : quand l'écran a un précédent (ex. Billets, qui revient à
  // Email), une petite flèche retour se glisse avant le logo plutôt que
  // de sacrifier le bandeau de marque pour un en-tête "retour" nu.
  onBack?: () => void
}) {
  const [logoLoaded, setLogoLoaded] = useState(false)
  const squircle = useSquircle<HTMLDivElement>(16)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-center gap-3 pt-[14px] pb-3 md:gap-5 md:pt-8 md:pb-6"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[oklch(0.95_0.01_260)] text-[oklch(0.3_0.02_260)] md:h-11 md:w-11"
        >
          <ArrowLeft size={16} strokeWidth={2.5} className="md:h-5 md:w-5" />
        </button>
      )}
      {!logoFailed && (
        <div
          ref={squircle.ref}
          style={squircle.style}
          className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl md:h-24 md:w-24 md:rounded-2xl ${!logoLoaded ? 'bg-gray-100' : ''}`}
        >
          <motion.img
            src={`${GATEWAY_URL}/services/${service.serviceId}/logo`}
            onLoad={() => setLogoLoaded(true)}
            onError={onLogoFail}
            initial={{ opacity: 0 }}
            animate={{ opacity: logoLoaded ? 1 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className="text-[15px] leading-[1.25] font-bold text-ink md:text-[26px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {service.name}
        </p>
        <p className="text-[11px] leading-[1.3] font-medium text-ink-soft md:text-[15px]">
          {service.serviceType === 'factures' ? 'Paiement en ligne' : 'Réservation en ligne'}
        </p>
      </div>
    </motion.div>
  )
}
