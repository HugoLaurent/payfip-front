import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Store } from 'lucide-react'
import { apiCall, GATEWAY_URL } from '@/lib/api'
import {
  Card,
  EmptyState,
  ListRow,
  ListRowSkeleton,
  LoadError,
  PageHeader,
  Pagination,
  StatusBadge,
  TextInput,
} from '@/components/ui'
import { usePaginatedResource } from '@/lib/usePaginatedResource'
import { useAuth } from '@/lib/useAuth'
import { SERVICE_STATUS_LABELS, SERVICE_STATUS_TINTS, SERVICE_TYPE_LABELS } from '@/lib/serviceLabels'
import type { PageMeta, ServiceRow } from '@/lib/types'

const PER_PAGE = 10

export function ServicesPage() {
  const { auth } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const {
    data: services,
    meta,
    loadFailed,
    showLoading,
    reload,
  } = usePaginatedResource<ServiceRow, PageMeta>({
    fetcher: () =>
      apiCall('GET', `/auth/services?q=${encodeURIComponent(q)}&page=${page}&perPage=${PER_PAGE}`, {
        token: auth.token,
      }),
    deps: [auth.token, q, page],
  })

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
        {loadFailed && <LoadError onRetry={reload} />}
        {!loadFailed && showLoading && <ListRowSkeleton />}
        {!loadFailed && !showLoading && services?.length === 0 && (
          <EmptyState icon={<Store size={28} />} label="Aucun service." />
        )}
        {!showLoading && services?.map((service, i) => (
          <ListRow
            key={service.id}
            index={i}
            onClick={() => navigate(`/services/${service.id}`, { state: { service } })}
            iconWrapperClassName={`h-12 w-12 rounded-xl ${
              service.hasLogo || service.status !== 'active'
                ? 'bg-gray-100'
                : 'bg-gradient-to-br from-aregie-deep to-aregie-light'
            }`}
            icon={
              service.hasLogo ? (
                <img
                  src={`${GATEWAY_URL}/services/${service.id}/logo`}
                  alt={service.name}
                  className="h-full w-full object-contain"
                />
              ) : service.status !== 'active' ? (
                <Store size={18} className="text-gray-300" />
              ) : null
            }
            title={
              <p
                className="truncate text-[14.5px] font-bold text-gray-900"
                style={{ fontFamily: 'var(--font-public)' }}
              >
                {service.name}
              </p>
            }
            subtitle={
              <p className="truncate text-[12.5px] font-medium text-gray-500">
                {SERVICE_TYPE_LABELS[service.serviceType] ?? service.serviceType}
              </p>
            }
            trailing={
              <>
                <StatusBadge
                  label={SERVICE_STATUS_LABELS[service.status] ?? service.status}
                  className={SERVICE_STATUS_TINTS[service.status] ?? 'bg-gray-100 text-gray-600'}
                />
                <ChevronRight size={18} className="shrink-0 text-gray-400" />
              </>
            }
          />
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

export default ServicesPage
