import { forwardRef } from 'react'

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput(props, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-aregie-blue focus:ring-2 focus:ring-aregie-tint/20 ${props.className ?? ''}`}
    />
  )
})

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-aregie-blue focus:ring-2 focus:ring-aregie-tint/20 ${props.className ?? ''}`}
    />
  )
}
