import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { Modal, PrimaryButton, TextInput } from '@/components/ui'
import { useAuth } from '@/lib/useAuth'
import { useToast } from '@/lib/useToast'
import { DEFAULT_PERMISSIONS, PERMISSION_LABELS } from './permissions'
import type { AgentPermissions } from '@/lib/types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Formulaire de création — agent (services + permissions) ou
// administrateur (accès complet, rien à cocher). Possède son propre état
// de formulaire : UsersManager n'a besoin de savoir que "un utilisateur
// vient d'être créé", pas des champs intermédiaires.
export function UserFormModal({
  mode,
  onClose,
  onCreated,
}: {
  mode: 'agent' | 'admin'
  onClose: () => void
  onCreated: () => void
}) {
  const { auth } = useAuth()
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [permissions, setPermissions] = useState<AgentPermissions>(DEFAULT_PERMISSIONS)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailInvalid = email !== '' && !EMAIL_PATTERN.test(email)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'agent' && serviceIds.length === 0) {
      setError('Choisissez au moins un service.')
      return
    }

    setCreating(true)
    setError(null)

    const result = await apiCall('POST', '/auth/users', {
      token: auth.token,
      body:
        mode === 'admin'
          ? { firstName, lastName, email, password, role: 'admin' }
          : { firstName, lastName, email, password, serviceIds, ...permissions },
    })

    setCreating(false)

    if (result.ok) {
      showToast('success', mode === 'admin' ? 'Administrateur créé' : 'Agent créé', email)
      onCreated()
    } else if (result.status === 409) {
      setError('Cet email est déjà utilisé.')
      showToast('error', 'Échec', 'Cet email est déjà utilisé.')
    } else if (mode === 'agent' && result.status === 422) {
      setError("Un des services choisis n'appartient pas à votre organisme.")
      showToast('error', 'Échec', "Un des services choisis n'appartient pas à votre organisme.")
    } else {
      setError('Échec de la création.')
      showToast('error', 'Échec', "Impossible de créer l'utilisateur.")
    }
  }

  return (
    <Modal title={mode === 'admin' ? 'Nouvel administrateur' : 'Nouvel agent'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <TextInput
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <TextInput
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div>
          <TextInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {emailInvalid && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <TriangleAlert size={12} />
              Adresse email invalide
            </p>
          )}
        </div>
        <TextInput
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {mode === 'agent' ? (
          <>
            <p className="text-xs text-gray-400">
              Devra choisir son propre mot de passe à sa première connexion.
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Services</p>
              <div className="flex flex-wrap gap-3">
                {auth.services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(s.id)}
                      onChange={(e) =>
                        setServiceIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={(e) =>
                        setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            Un administrateur a un accès complet à l'organisme et devra choisir son propre mot de
            passe à sa première connexion.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <PrimaryButton type="submit" disabled={creating} className="w-full">
          {creating ? 'Création…' : 'Créer'}
        </PrimaryButton>
      </form>
    </Modal>
  )
}
