import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// Le même QR reste dans le champ de la caméra tant que l'agent ne
// l'enlève pas — un simple cooldown temporel le laisserait resoumis en
// boucle tant qu'il reste dans le cadre. On verrouille donc le code tant
// qu'il est détecté, et on ne le libère que lorsqu'il a disparu du cadre
// pendant plus de QR_ABSENCE_GRACE_MS (tolère une frame ratée sans pour
// autant considérer que le billet a été retiré).
const QR_ABSENCE_GRACE_MS = 600

// Boucle caméra : capture une frame vidéo dans un canvas caché, tente
// d'y décoder un QR à chaque frame. jsQR tourne entièrement côté
// client (pas d'appel réseau tant qu'aucun QR n'est détecté).
export function useQrScanner({
  active,
  paused,
  onDetected,
}: {
  active: boolean
  // Vrai pendant qu'un résultat de scan est affiché par-dessus la
  // caméra — inutile de continuer à décoder pendant ce temps.
  paused: boolean
  onDetected: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScannedRef = useRef<string | null>(null)
  const qrAbsentSinceRef = useRef<number | null>(null)
  // Un appel de validation en cours : distinct de `paused`, qui ne
  // couvre que "un résultat est affiché" — ce ref évite de soumettre le
  // même code deux fois pendant la fenêtre où la requête est en vol,
  // avant même qu'un résultat n'existe. Muté depuis l'appelant (voir
  // submitCode/submitOrderCode dans ScannerPage).
  const scanningRef = useRef(false)
  const pausedRef = useRef(paused)
  const onDetectedRef = useRef(onDetected)
  pausedRef.current = paused
  onDetectedRef.current = onDetected

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setCameraError(null)
        setTorchOn(false)
        // @ts-expect-error torch n'est pas dans le type standard MediaTrackCapabilities
        setTorchSupported(Boolean(stream.getVideoTracks()[0]?.getCapabilities?.().torch))
        lastScannedRef.current = null
        qrAbsentSinceRef.current = null
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch {
        setCameraError(
          "Impossible d'accéder à la caméra — vérifiez les autorisations, ou basculez en saisie manuelle."
        )
      }
    }

    function tick() {
      if (cancelled) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!pausedRef.current && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const qr = jsQR(imageData.data, imageData.width, imageData.height)
          const code = qr?.data ?? null

          if (code && code === lastScannedRef.current) {
            // Même billet toujours dans le cadre : déjà soumis, on attend.
            qrAbsentSinceRef.current = null
          } else if (code) {
            if (!scanningRef.current) {
              lastScannedRef.current = code
              qrAbsentSinceRef.current = null
              onDetectedRef.current(code)
            }
          } else if (lastScannedRef.current) {
            if (qrAbsentSinceRef.current === null) {
              qrAbsentSinceRef.current = Date.now()
            } else if (Date.now() - qrAbsentSinceRef.current > QR_ABSENCE_GRACE_MS) {
              lastScannedRef.current = null
              qrAbsentSinceRef.current = null
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [active])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !torchSupported) return
    const next = !torchOn
    try {
      // @ts-expect-error torch n'est pas dans le type standard MediaTrackConstraintSet
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      // Support annoncé par getCapabilities() mais refusé à l'usage (arrive
      // sur certains Android) : on ignore silencieusement, le bouton reste
      // visible mais n'aura simplement pas d'effet.
    }
  }

  return { videoRef, canvasRef, cameraError, scanningRef, torchSupported, torchOn, toggleTorch }
}
