import { useEffect, useState } from 'react'
import type { ApiResult } from './api'
import { useDelayedLoading } from './useDelayedLoading'

// Pattern répété par la plupart des listes de l'espace organisme : requête
// débattue de 250ms quand un filtre change (évite un appel par frappe
// pendant la recherche), état de chargement/erreur, et un `reload()`
// immédiat (sans debounce) pour rejouer après une mutation (création,
// suppression…) ou un clic "Réessayer".
export function usePaginatedResource<T, Meta = unknown>({
  fetcher,
  deps,
  enabled = true,
  debounceMs = 250,
}: {
  fetcher: () => Promise<ApiResult<{ data: T[]; meta: Meta }>>
  // Tout ce qui doit redéclencher la requête (filtres, page, token…) — le
  // hook ne peut pas le déduire de `fetcher` lui-même, il faut l'expliciter
  // comme pour un useEffect classique.
  deps: unknown[]
  enabled?: boolean
  debounceMs?: number
}) {
  const [data, setData] = useState<T[] | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const showLoading = useDelayedLoading(data === null)

  async function load() {
    setLoadFailed(false)
    const result = await fetcher()
    if (result.ok) {
      setData(result.data.data)
      setMeta(result.data.meta)
    } else {
      setLoadFailed(true)
    }
  }

  useEffect(() => {
    if (!enabled) return
    const timeout = setTimeout(load, debounceMs)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  return { data, meta, loadFailed, showLoading, reload: load }
}
