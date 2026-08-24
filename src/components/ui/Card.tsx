import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`squircle rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(20,25,60,0.06)] ${className}`}
    >
      {children}
    </div>
  )
}
