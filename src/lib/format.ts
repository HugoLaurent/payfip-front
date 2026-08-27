export function euros(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`
}

// "YYYY-MM-DD" -> "samedi 12 septembre 2026" — toujours interprété en
// local (jamais new Date(iso) seul, qui lirait un "YYYY-MM-DD" en UTC et
// décalerait d'un jour en arrière tôt le matin en Europe/Paris).
export function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
