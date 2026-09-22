export function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`inline-flex items-center justify-center gap-2 squircle rounded-full bg-aregie-deep px-5 py-2.5 text-sm font-bold text-white transition hover:bg-aregie-blue disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`inline-flex items-center justify-center gap-2 squircle rounded-full border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

// Variantes pour la bannière bleue du panel staff (StaffHero) — le fond
// aregie-deep rend les boutons pleins/outline habituels illisibles, il
// faut un blanc plein (action principale) et un translucide (secondaire).
export function HeroButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`inline-flex items-center justify-center gap-2 squircle rounded-full bg-white px-4 py-2 text-sm font-bold text-aregie-deep transition hover:bg-white/90 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

export function HeroGhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`inline-flex items-center justify-center gap-2 squircle rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`inline-flex items-center justify-center gap-2 squircle rounded-full border border-red-200 px-3.5 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}
