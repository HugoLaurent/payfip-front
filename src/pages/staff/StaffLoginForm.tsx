import { useState } from 'react'
import { apiCall } from '@/lib/api'
import { saveStoredStaffKey } from '@/lib/storage'
import { PrimaryButton, TextInput } from '@/components/ui'

// Pas d'endpoint de login staff (secret partagé, pas de compte individuel)
// — on valide la clé en tentant un vrai premier appel plutôt que de la
// stocker à l'aveugle.
export function StaffLoginForm({ onLoggedIn }: { onLoggedIn: (staffKey: string) => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await apiCall('GET', '/staff/organizations', { staffKey: key })

    setLoading(false)

    if (!result.ok) {
      setError('Clé invalide.')
      return
    }

    saveStoredStaffKey(key)
    onLoggedIn(key)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="squircle w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="squircle flex h-10 w-10 items-center justify-center rounded-xl bg-aregie-deep text-base font-bold text-white">
            A
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">PAYFIP</h1>
            <p className="text-sm text-gray-500">Panel staff AREGIE</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Clé d'accès</label>
          <TextInput
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={loading || !key} className="mt-6 w-full py-2.5">
          {loading ? 'Vérification…' : 'Entrer'}
        </PrimaryButton>
      </form>
    </div>
  )
}

export default StaffLoginForm
