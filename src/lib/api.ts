import { clearStoredAuth, clearStoredStaffToken } from './storage'
import { resolveDemoApi } from '@/demoStatic/router'

export const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string) ?? 'http://localhost:3000'

// Build "démo statique" (demofip.aregie.com) : aucun backend, aucun réseau —
// tout appel passe par src/demoStatic/router.ts à la place de fetch(). Seul
// ce module (jamais utile en build normal) grossit un peu le bundle du
// build démo — non gênant, cette build n'est jamais celle servie en prod.
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true'

/**
 * Session expirée (401 avec un token présent) : on repart proprement sur
 * l'écran de connexion plutôt que de laisser l'écran bloqué sur
 * "Chargement…". Distinct de la session staff (stockage et redirection
 * différents) pour ne jamais vider la mauvaise session ni renvoyer un
 * membre du staff sur l'accueil citoyen.
 */
function handleUnauthorized(status: number, hadToken: boolean) {
  if (status === 401 && hadToken) {
    clearStoredAuth()
    window.location.href = '/'
  }
}

function handleStaffUnauthorized(status: number, hadStaffToken: boolean) {
  if (status === 401 && hadStaffToken) {
    clearStoredStaffToken()
    window.location.href = '/staff'
  }
}

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

// Au-delà, on considère le Gateway injoignable plutôt que de laisser l'UI
// en "Chargement…" indéfiniment (ex: coupure réseau côté agent terrain).
const DEFAULT_TIMEOUT_MS = 20_000

// status: 0 distingue une panne réseau/timeout (jamais renvoyée par le
// Gateway) d'une vraie réponse HTTP, pour que les appelants puissent
// afficher "pas de réseau" plutôt qu'une erreur métier.
function networkFailureResult<T>(): ApiResult<T> {
  return { ok: false, status: 0, data: null as T }
}

/** Appelle le Gateway — jamais un service interne directement. */
export async function apiCall<T = unknown>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; staffToken?: string } = {}
): Promise<ApiResult<T>> {
  if (STATIC_DEMO) return resolveDemoApi(method, path, options) as ApiResult<T>

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  else if (options.staffToken) headers.Authorization = `Bearer ${options.staffToken}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch {
    // Coupure réseau, DNS, CORS, ou timeout (abort) — jamais laisser
    // l'appelant sans réponse, sinon l'UI reste bloquée en chargement.
    return networkFailureResult<T>()
  } finally {
    clearTimeout(timeout)
  }

  handleUnauthorized(res.status, Boolean(options.token))
  handleStaffUnauthorized(res.status, Boolean(options.staffToken))

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // pas de corps JSON (ex: 204)
  }

  return { ok: res.ok, status: res.status, data: json as T }
}

/**
 * Récupère un PDF (billets, facture…) et l'ouvre dans un nouvel onglet —
 * factorise le fetch+blob+window.open répété dans HistoriquePage,
 * VentePage et PurchaseReturnPage, avec le même filet try/catch que
 * apiCall (sans lui, une coupure réseau laissait un état "chargement en
 * cours" bloqué indéfiniment côté appelant).
 */
export async function openPdfInNewTab(path: string, token?: string): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
    if (!res.ok) return false
    const blob = await res.blob()
    window.open(URL.createObjectURL(blob), '_blank')
    return true
  } catch {
    return false
  }
}

/**
 * Upload multipart — pas de Content-Type manuel, le navigateur génère
 * lui-même le boundary à partir du FormData.
 */
export async function apiUpload<T = unknown>(
  path: string,
  file: File,
  token: string,
  fieldName = 'logo',
  isStaff = false
): Promise<ApiResult<T>> {
  const formData = new FormData()
  formData.append(fieldName, file)

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (isStaff) handleStaffUnauthorized(res.status, true)
  else handleUnauthorized(res.status, true)

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // pas de corps JSON
  }

  return { ok: res.ok, status: res.status, data: json as T }
}

/**
 * Upload multipart citoyen (pas de session/JWT client, contrairement à
 * apiUpload) — un fichier par slot nommé (clé = exigence de document, voir
 * DocumentRequirement) + des champs texte à côté (ex. dépôt de
 * justificatifs d'inscription : eventId/email/nom/prénom + 1 à N pièces
 * nommées). Pas de Content-Type manuel, FormData génère lui-même le
 * boundary.
 */
export async function apiUploadWithFields<T = unknown>(
  path: string,
  files: Record<string, File>,
  fields: Record<string, string>
): Promise<ApiResult<T>> {
  if (STATIC_DEMO) return resolveDemoApi('POST', path, { body: fields }) as ApiResult<T>

  const formData = new FormData()
  for (const [key, file] of Object.entries(files)) formData.append(key, file)
  for (const [key, value] of Object.entries(fields)) formData.append(key, value)

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    body: formData,
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // pas de corps JSON
  }

  return { ok: res.ok, status: res.status, data: json as T }
}
