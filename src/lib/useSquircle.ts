import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { getSvgPath } from 'figma-squircle'

// Un vrai squircle (superellipse à la iOS/Figma) n'est pas un simple
// border-radius CSS — la courbure y est continue au lieu de raccorder
// brutalement un arc de cercle à une arête droite. `figma-squircle` génère
// le tracé SVG exact pour la taille réelle de l'élément (d'où le
// ResizeObserver), appliqué en clip-path. On garde le `rounded-*`
// Tailwind existant sur l'élément en parallèle : il sert de repli le
// temps du tout premier layout, avant que ce hook n'ait mesuré l'élément.
export function useSquircle<T extends HTMLElement = HTMLDivElement>(
  cornerRadius: number,
  cornerSmoothing = 0.75
) {
  const ref = useRef<T>(null)
  const [clipPath, setClipPath] = useState<string | undefined>()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (!width || !height) return
      setClipPath(`path('${getSvgPath({ width, height, cornerRadius, cornerSmoothing })}')`)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [cornerRadius, cornerSmoothing])

  return { ref, style: { clipPath } as CSSProperties }
}
