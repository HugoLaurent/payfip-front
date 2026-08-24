export function PublicButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ fontFamily: 'var(--font-display)' }}
      className={`squircle inline-flex items-center justify-center gap-2 rounded-full bg-aregie-coral px-7 py-[15px] text-[15px] font-bold text-white shadow-[0_10px_24px_-8px_oklch(0.62_0.19_35_/_0.6)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  )
}

export function PublicGhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`squircle inline-flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-white px-4 py-3 text-sm font-semibold text-aregie-deep transition hover:border-aregie-deep/30 hover:bg-aregie-deep/[0.03] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
