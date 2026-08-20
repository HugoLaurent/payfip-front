import { useEffect, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw, Ticket, Trash2 } from 'lucide-react'
import { apiCall } from '@/lib/api'
import {
  Card,
  DangerButton,
  EmptyState,
  LoadError,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
} from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { AuthState, ServiceRow } from '@/lib/types'

interface Tariff {
  id: number
  tariffType: string
  priceCents: number
  status: string
}

interface BudgetCode {
  code: string
  label: string
}

export function TariffsManager({ auth, service }: { auth: AuthState; service: ServiceRow }) {
  const servicePermissions = auth.services.find((s) => s.id === service.id)?.permissions
  const canManage = auth.role === 'admin' || servicePermissions?.canManageTariffs === true

  const [tariffs, setTariffs] = useState<Tariff[] | null>(null)
  const [budgetCodes, setBudgetCodes] = useState<BudgetCode[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [newType, setNewType] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newBudgetCode, setNewBudgetCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingTariff, setDeletingTariff] = useState<Tariff | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [loadFailed, setLoadFailed] = useState(false)
  const showLoading = useDelayedLoading(tariffs === null)

  async function loadTariffs() {
    setLoadFailed(false)
    const result = await apiCall<{ data: Tariff[] }>(
      'GET',
      `/billetterie/services/${service.id}/tariffs`,
      { token: auth.token }
    )
    if (result.ok) setTariffs(result.data.data)
    else setLoadFailed(true)
  }

  useEffect(() => {
    loadTariffs()

    if (canManage && service.numcli) {
      apiCall<{ data: BudgetCode[] }>(
        'GET',
        `/billetterie/budget-codes?numcli=${encodeURIComponent(service.numcli)}&serviceId=${service.id}`,
        { token: auth.token }
      ).then((result) => setBudgetCodes(result.ok ? result.data.data : []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!service.numcli) return

    setCreating(true)
    setError(null)

    const result = await apiCall('POST', `/billetterie/services/${service.id}/tariffs`, {
      token: auth.token,
      body: {
        tariffType: newType,
        priceCents: Math.round(Number(newPrice) * 100),
        numcli: service.numcli,
        budgetCode: newBudgetCode,
      },
    })

    setCreating(false)

    if (result.ok) {
      setNewType('')
      setNewPrice('')
      setNewBudgetCode('')
      setShowCreateModal(false)
      await loadTariffs()
    } else if (result.status === 409) {
      setError('Ce type de tarif existe déjà pour ce service.')
    } else if (result.status === 422) {
      setError('Code budgétaire inconnu pour cette régie.')
    } else {
      setError('Échec de la création.')
    }
  }

  async function handleArchive(tariffId: number) {
    await apiCall('PATCH', `/billetterie/tariffs/${tariffId}`, {
      token: auth.token,
      body: { status: 'archived' },
    })
    await loadTariffs()
  }

  async function handleReactivate(tariffId: number) {
    await apiCall('PATCH', `/billetterie/tariffs/${tariffId}`, {
      token: auth.token,
      body: { status: 'active' },
    })
    await loadTariffs()
  }

  async function handleDelete() {
    if (!deletingTariff) return
    setDeleting(true)
    await apiCall('DELETE', `/billetterie/tariffs/${deletingTariff.id}`, { token: auth.token })
    setDeleting(false)
    setDeletingTariff(null)
    await loadTariffs()
  }

  function openEdit(tariff: Tariff) {
    setEditingTariff(tariff)
    setEditPrice((tariff.priceCents / 100).toFixed(2))
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTariff) return

    setSaving(true)
    setEditError(null)

    const result = await apiCall('PATCH', `/billetterie/tariffs/${editingTariff.id}`, {
      token: auth.token,
      body: { priceCents: Math.round(Number(editPrice) * 100) },
    })

    setSaving(false)

    if (result.ok) {
      setEditingTariff(null)
      await loadTariffs()
    } else {
      setEditError('Échec de la modification.')
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <Ticket size={15} />
          Tarifs
        </h3>
        {canManage && (
          <PrimaryButton type="button" onClick={() => setShowCreateModal(true)} className="py-1.5 text-xs">
            <Plus size={14} />
            Ajouter un tarif
          </PrimaryButton>
        )}
      </div>

      <div className="space-y-2">
        {loadFailed && <LoadError onRetry={loadTariffs} />}
        {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && tariffs?.filter((t) => t.status === 'active').length === 0 && (
          <EmptyState icon={<Ticket size={24} />} label="Aucun tarif actif." />
        )}
        {tariffs
          ?.filter((t) => t.status === 'active')
          .map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{t.tariffType}</p>
                <p className="text-sm text-gray-500">{(t.priceCents / 100).toFixed(2)} €</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton type="button" onClick={() => openEdit(t)}>
                    <Pencil size={14} />
                    Modifier
                  </SecondaryButton>
                  <DangerButton type="button" onClick={() => handleArchive(t.id)}>
                    <Archive size={14} />
                    Désactiver
                  </DangerButton>
                </div>
              )}
            </Card>
          ))}
      </div>

      {canManage && tariffs && tariffs.some((t) => t.status !== 'active') && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Tarifs désactivés
          </p>
          <div className="space-y-2">
            {tariffs
              .filter((t) => t.status !== 'active')
              .map((t) => (
                <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 opacity-60">
                  <div>
                    <p className="font-medium text-gray-900">{t.tariffType}</p>
                    <p className="text-sm text-gray-500">{(t.priceCents / 100).toFixed(2)} €</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton type="button" onClick={() => handleReactivate(t.id)}>
                      <RotateCcw size={14} />
                      Réactiver
                    </SecondaryButton>
                    <DangerButton type="button" onClick={() => setDeletingTariff(t)}>
                      <Trash2 size={14} />
                      Supprimer
                    </DangerButton>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <Modal title="Nouveau tarif" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <TextInput
              type="text"
              placeholder="Type (ex: Plein tarif)"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              required
            />
            <TextInput
              type="number"
              step="0.01"
              min="0"
              placeholder="Prix en euros"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              required
            />
            <SelectInput value={newBudgetCode} onChange={(e) => setNewBudgetCode(e.target.value)} required>
              <option value="" disabled>
                Code budgétaire…
              </option>
              {budgetCodes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </SelectInput>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <PrimaryButton type="submit" disabled={creating} className="w-full">
              {creating ? 'Création…' : 'Créer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {editingTariff && (
        <Modal title={`Modifier « ${editingTariff.tariffType} »`} onClose={() => setEditingTariff(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              placeholder="Prix en euros"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              required
            />

            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <PrimaryButton type="submit" disabled={saving} className="w-full">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {deletingTariff && (
        <Modal title="Supprimer définitivement ?" onClose={() => setDeletingTariff(null)}>
          <p className="mb-4 text-sm text-gray-600">
            Le tarif « {deletingTariff.tariffType} » sera supprimé définitivement. Les commandes déjà
            passées avec ce tarif ne sont pas affectées.
          </p>
          <div className="flex gap-2">
            <DangerButton type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2">
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </DangerButton>
            <SecondaryButton type="button" onClick={() => setDeletingTariff(null)}>
              Annuler
            </SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
