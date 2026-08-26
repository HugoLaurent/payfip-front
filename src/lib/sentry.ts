import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_GLITCHTIP_DSN as string | undefined
if (dsn) {
  Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 })
}
