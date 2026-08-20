const AUTH_KEY = 'payfip_front_auth'

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
