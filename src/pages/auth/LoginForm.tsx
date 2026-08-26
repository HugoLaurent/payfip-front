import { useState } from 'react'
import { apiCall } from '@/lib/api'
import { saveStoredAuth } from '@/lib/storage'
import { PrimaryButton, TextInput } from '@/components/ui'
import type { AuthState } from '@/lib/types'

interface LoginResponse {
  data: AuthState
}

export function LoginForm({ onLoggedIn }: { onLoggedIn: (auth: AuthState) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await apiCall<LoginResponse>('POST', '/auth/login', {
      body: { email, password },
    })

    setLoading(false)

    if (!result.ok) {
      setError('Identifiants invalides.')
      return
    }

    const auth = result.data.data
    saveStoredAuth(auth)
    onLoggedIn(auth)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="squircle w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="squircle flex h-10 w-10 items-center justify-center rounded-xl bg-aregie-deep text-base font-bold text-white">
            P
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">PAYFIP</h1>
            <p className="text-sm text-gray-500">Espace organisme</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={loading} className="mt-6 w-full py-2.5">
          {loading ? 'Connexion…' : 'Se connecter'}
        </PrimaryButton>
      </form>
    </div>
  )
}
