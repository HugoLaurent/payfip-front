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
