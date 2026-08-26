import { useEffect, useState } from 'react'
import { decodeJwtPayload } from '@/lib/decodeJwtPayload'

interface StaffTokenPayload {
  email: string
  name: string | null
}

// Reçoit la redirection de la Gateway après le retour d'Authentik. Le token
// arrive dans le fragment d'URL (#token=...), jamais en query string — il
// n'atterrit donc ni dans les logs serveur ni dans un Referer.
export function StaffAuthCallback({
  onLoggedIn,
}: {
  onLoggedIn: (token: string, email: string, name: string | null) => void
}) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')
    const oidcError = params.get('error')

    if (oidcError) {
      setError("La connexion a échoué. Réessayez, ou contactez un administrateur si le problème persiste.")
      return
    }

    if (!token) {
      setError('Lien de connexion invalide.')
      return
    }

    const payload = decodeJwtPayload<StaffTokenPayload>(token)
    if (!payload) {
      setError('Lien de connexion invalide.')
      return
    }

    onLoggedIn(token, payload.email, payload.name)
  }, [onLoggedIn])

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
      <div className="squircle w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        {error ? (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <a href="/staff" className="mt-4 inline-block text-sm text-aregie-deep underline">
              Retour à la connexion
            </a>
          </>
        ) : (
          <p className="text-sm text-gray-500">Connexion en cours…</p>
        )}
      </div>
    </div>
  )
}

export default StaffAuthCallback
