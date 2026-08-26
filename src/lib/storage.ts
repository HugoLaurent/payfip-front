const AUTH_KEY = 'payfip_front_auth'
const STAFF_TOKEN_KEY = 'payfip_front_staff_token'

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

// JWT de session staff, émis par la Gateway après connexion SSO Authentik
// (voir StaffAuthCallback) — un par membre du staff, expire après 2h.
export function loadStoredStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN_KEY)
}

export function saveStoredStaffToken(token: string): void {
  localStorage.setItem(STAFF_TOKEN_KEY, token)
}

export function clearStoredStaffToken(): void {
  localStorage.removeItem(STAFF_TOKEN_KEY)
}
