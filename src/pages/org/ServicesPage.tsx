import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Store } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import { Card, EmptyState, LoadError, PageHeader, Pagination, TextInput } from '@/components/ui'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import type { AuthState, PageMeta, ServiceRow } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const PER_PAGE = 10

export function ServicesPage({ auth }: { auth: AuthState }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [services, setServices] = useState<ServiceRow[] | null>(null)
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const showLoading = useDelayedLoading(services === null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoadFailed(false)
      apiCall<{ data: ServiceRow[]; meta: PageMeta }>(
        'GET',
        `/auth/services?q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`,
        { token: auth.token }
      ).then((result) => {
        if (result.ok) {
          setServices(result.data.data)
          setMeta(result.data.meta)
        } else {
          setLoadFailed(true)
        }
      })
    }, 250)

    return () => clearTimeout(timeout)
  }, [auth.token, q, page, reloadKey])

  return (
    <div>
      <PageHeader icon={<Store size={20} />} title="Services" subtitle={auth.orgName} />

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <TextInput
          placeholder="Rechercher un service…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {loadFailed && <LoadError onRetry={() => setReloadKey((k) => k + 1)} />}
        {!loadFailed && showLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {!loadFailed && services?.length === 0 && (
          <EmptyState icon={<Store size={28} />} label="Aucun service." />
        )}
        {services?.map((service) => (
          <motion.button
            key={service.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => navigate(`/services/${service.id}`, { state: { service } })}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition-shadow hover:ring-aregie-blue/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {service.hasLogo ? (
                <img
                  src={`${GATEWAY_URL}/services/${service.id}/logo`}
                  alt={service.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Store size={18} className="text-gray-300" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{service.name}</p>
              <p className="text-sm text-gray-500 capitalize">
                {service.serviceType} · {STATUS_LABELS[service.status] ?? service.status}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      {meta && meta.lastPage > 1 && (
        <Card className="mt-4">
          <Pagination
            currentPage={meta.currentPage}
            lastPage={meta.lastPage}
            total={meta.total}
            onChange={setPage}
          />
        </Card>
      )}
    </div>
  )
}
