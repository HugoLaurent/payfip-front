// Décodage local du payload d'un JWT, à but d'affichage uniquement (ex.
// "connecté en tant que X") — ne vérifie ni la signature ni l'expiration.
// La Gateway revérifie le token en entier à chaque appel API ; ce décodage
// côté front n'a aucune valeur de sécurité, seulement de confort d'UI.
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const [, payloadB64] = token.split('.')
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    )
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
