const AUTH_KEY = 'payfip_front_auth'
const STAFF_KEY = 'payfip_front_staff_key'

export function loadStoredAuth<T>(): T | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveStoredAuth<T>(value: T): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(value))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_KEY)
}

// Le staff n'a pas de compte individuel — un unique secret partagé
// (STAFF_API_KEY côté gateway), stocké tel quel, pas de JSON.
export function loadStoredStaffKey(): string | null {
  return localStorage.getItem(STAFF_KEY)
}

export function saveStoredStaffKey(key: string): void {
  localStorage.setItem(STAFF_KEY, key)
}

export function clearStoredStaffKey(): void {
  localStorage.removeItem(STAFF_KEY)
}
