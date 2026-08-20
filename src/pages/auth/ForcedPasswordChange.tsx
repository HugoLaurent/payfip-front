import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { PrimaryButton, SecondaryButton, TextInput } from '@/components/ui'
import type { AuthState } from '@/lib/types'

export function ForcedPasswordChange({
  auth,
  onChanged,
  onLogout,
}: {
  auth: AuthState
  onChanged: (patch: Partial<AuthState>) => void
  onLogout: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await apiCall('PATCH', '/auth/me/password', {
      token: auth.token,
      body: { currentPassword, newPassword },
    })

    setSubmitting(false)

    if (result.ok) {
      onChanged({ passwordChangeRequired: false })
      return
    }

    if (result.status === 401) {
      setError('Mot de passe actuel incorrect.')
    } else if (result.status === 422) {
      setError('Vous ne pouvez pas réutiliser vos deux derniers mots de passe.')
    } else {
      setError('Échec du changement de mot de passe.')
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5"
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-aregie-deep/10 text-aregie-deep">
          <KeyRound size={18} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Changement de mot de passe requis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pour des raisons de sécurité, vous devez choisir un nouveau mot de passe avant de
          continuer (première connexion, ou mot de passe non renouvelé depuis plus de 90 jours).
        </p>

        <div className="mt-5 space-y-3">
          <TextInput
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
            required
          />
          <TextInput
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <TextInput
            type="password"
            placeholder="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={submitting} className="mt-6 w-full py-2.5">
          {submitting ? 'Changement…' : 'Changer le mot de passe'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onLogout} className="mt-2 w-full justify-center">
          Déconnexion
        </SecondaryButton>
      </form>
    </div>
  )
}
