import { clearStoredAuth } from './storage'

export const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string) ?? 'http://localhost:3000'

/** Session expirée (JWT client, 2h) : on repart proprement sur l'écran de connexion plutôt que de laisser chaque écran bloqué sur "Chargement…". */
function handleUnauthorized(status: number, hadToken: boolean) {
  if (status === 401 && hadToken) {
    clearStoredAuth()
    window.location.href = '/'
  }
}

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

/** Appelle le Gateway — jamais un service interne directement. */
export async function apiCall<T = unknown>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  handleUnauthorized(res.status, Boolean(options.token))

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // pas de corps JSON (ex: 204)
  }

  return { ok: res.ok, status: res.status, data: json as T }
}

/**
 * Upload multipart — pas de Content-Type manuel, le navigateur génère
 * lui-même le boundary à partir du FormData.
 */
export async function apiUpload<T = unknown>(
  path: string,
  file: File,
  token: string,
  fieldName = 'logo'
): Promise<ApiResult<T>> {
  const formData = new FormData()
  formData.append(fieldName, file)

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  handleUnauthorized(res.status, true)

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // pas de corps JSON
  }

  return { ok: res.ok, status: res.status, data: json as T }
}
