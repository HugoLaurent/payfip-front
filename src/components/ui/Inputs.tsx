import { forwardRef } from 'react'

const FIELD_CLASSES =
  'squircle w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-aregie-blue focus:ring-2 focus:ring-aregie-tint/20 user-invalid:border-red-400 user-invalid:bg-red-50/40'

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput(props, ref) {
  return (
    <input {...props} ref={ref} className={`${FIELD_CLASSES} ${props.className ?? ''}`} />
  )
})

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASSES} ${props.className ?? ''}`} />
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, ref) {
  return (
    <textarea {...props} ref={ref} className={`${FIELD_CLASSES} resize-none ${props.className ?? ''}`} />
  )
})
