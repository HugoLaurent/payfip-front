import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Ticket, Trash2 } from 'lucide-react'
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
  Switch,
  TextInput,
} from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useToast } from '@/lib/useToast'
import { euros } from '@/lib/format'
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
  const { showToast } = useToast()

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
      showToast('success', 'Tarif créé', newType)
      setNewType('')
      setNewPrice('')
      setNewBudgetCode('')
      setShowCreateModal(false)
      await loadTariffs()
    } else if (result.status === 409) {
      setError('Ce type de tarif existe déjà pour ce service.')
      showToast('error', 'Échec', 'Ce type de tarif existe déjà pour ce service.')
    } else if (result.status === 422) {
      setError('Code budgétaire inconnu pour cette régie.')
      showToast('error', 'Échec', 'Code budgétaire inconnu pour cette régie.')
    } else {
      setError('Échec de la création.')
      showToast('error', 'Échec', 'Impossible de créer le tarif.')
    }
  }

  async function handleArchive(tariffId: number) {
    const tariffType = tariffs?.find((t) => t.id === tariffId)?.tariffType ?? ''
    const result = await apiCall('PATCH', `/billetterie/tariffs/${tariffId}`, {
      token: auth.token,
      body: { status: 'archived' },
    })
    if (result.ok) showToast('success', 'Tarif désactivé', tariffType)
    else showToast('error', 'Échec', 'Impossible de désactiver le tarif.')
    await loadTariffs()
  }

  async function handleReactivate(tariffId: number) {
    const tariffType = tariffs?.find((t) => t.id === tariffId)?.tariffType ?? ''
    const result = await apiCall('PATCH', `/billetterie/tariffs/${tariffId}`, {
      token: auth.token,
      body: { status: 'active' },
    })
    if (result.ok) showToast('success', 'Tarif réactivé', tariffType)
    else showToast('error', 'Échec', 'Impossible de réactiver le tarif.')
    await loadTariffs()
  }

  async function handleDelete() {
    if (!deletingTariff) return
    setDeleting(true)
    const result = await apiCall('DELETE', `/billetterie/tariffs/${deletingTariff.id}`, { token: auth.token })
    setDeleting(false)
    if (result.ok) showToast('success', 'Tarif supprimé', deletingTariff.tariffType)
    else showToast('error', 'Échec', 'Impossible de supprimer le tarif.')
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
      showToast('success', 'Tarif modifié', editingTariff.tariffType)
      setEditingTariff(null)
      await loadTariffs()
    } else {
      setEditError('Échec de la modification.')
      showToast('error', 'Échec', 'Impossible de modifier le tarif.')
    }
  }

  const activeTariffs = tariffs?.filter((t) => t.status === 'active') ?? []
  const archivedTariffs = tariffs?.filter((t) => t.status !== 'active') ?? []

  return (
    <div>
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3
            className="text-sm font-bold text-gray-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Grille tarifaire
          </h3>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{ fontFamily: 'var(--font-display)' }}
              className="squircle inline-flex items-center gap-1.5 rounded-full bg-aregie-deep/10 px-4 py-2 text-xs font-bold text-aregie-deep transition hover:bg-aregie-deep/15"
            >
              <Plus size={14} />
              Ajouter un tarif
            </button>
          )}
        </div>

        {loadFailed && <LoadError onRetry={loadTariffs} />}
        {!loadFailed && showLoading && <p className="py-3 text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && activeTariffs.length === 0 && (
          <div className="py-2">
            <EmptyState icon={<Ticket size={24} />} label="Aucun tarif actif." />
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {activeTariffs.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                {t.tariffType}
              </p>
              <p
                className={`w-20 shrink-0 text-right text-sm font-bold ${t.priceCents === 0 ? 'text-emerald-600' : 'text-gray-900'}`}
              >
                {t.priceCents === 0 ? 'Gratuit' : euros(t.priceCents)}
              </p>
              {canManage ? (
                <>
                  <Switch checked onChange={() => handleArchive(t.id)} />
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="shrink-0 text-gray-400 transition hover:text-aregie-deep"
                    aria-label={`Modifier « ${t.tariffType} »`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              ) : (
                <ChevronRight size={18} className="shrink-0 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {canManage && archivedTariffs.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Tarifs désactivés
          </p>
          <Card>
            <div className="divide-y divide-gray-100">
              {archivedTariffs.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3 opacity-60">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {t.tariffType}
                  </p>
                  <p className="w-20 shrink-0 text-right text-sm font-bold text-gray-900">
                    {t.priceCents === 0 ? 'Gratuit' : euros(t.priceCents)}
                  </p>
                  <Switch checked={false} onChange={() => handleReactivate(t.id)} />
                  <button
                    type="button"
                    onClick={() => setDeletingTariff(t)}
                    className="shrink-0 text-gray-400 transition hover:text-red-600"
                    aria-label={`Supprimer « ${t.tariffType} »`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
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
