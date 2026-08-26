import { GATEWAY_URL } from '@/lib/api'
import { PrimaryButton } from '@/components/ui'

// SSO Authentik — pas de formulaire ici, juste une redirection vers la
// Gateway qui orchestre le flux OAuth2 (voir /staff/auth/login côté
// backend). Le retour passe par StaffAuthCallback.
export function StaffLoginForm() {
  function handleLogin() {
    window.location.href = `${GATEWAY_URL}/staff/auth/login`
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
      <div className="squircle w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="squircle flex h-10 w-10 items-center justify-center rounded-xl bg-aregie-deep text-base font-bold text-white">
            A
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">PAYFIP</h1>
            <p className="text-sm text-gray-500">Panel staff AREGIE</p>
          </div>
        </div>

        <PrimaryButton type="button" onClick={handleLogin} className="w-full py-2.5">
          Se connecter avec Authentik
        </PrimaryButton>
      </div>
    </div>
  )
}

export default StaffLoginForm
