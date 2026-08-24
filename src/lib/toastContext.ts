import { createContext } from 'react'

export type ToastVariant = 'success' | 'error'

export interface ToastContextValue {
  showToast: (variant: ToastVariant, title: string, message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
