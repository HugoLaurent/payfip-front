// Génère et déclenche le téléchargement d'un fichier .ics pour une
// inscription confirmée — entièrement côté client, aucun endpoint dédié
// (pas de backend impliqué). Horaire flottant (pas de Z/timezone) : le
// client de calendrier interprète dans le fuseau local de l'appareil,
// suffisant ici puisqu'on n'a pas de fuseau explicite côté back.
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function downloadEventIcs(params: {
  title: string
  description?: string | null
  location?: string | null
  eventDate: string // "YYYY-MM-DD"
  startTime?: string | null // "HH:mm"
  endTime?: string | null // "HH:mm"
}): void {
  const { title, description, location, eventDate, startTime, endTime } = params
  const dateCompact = eventDate.replace(/-/g, '')

  let dtStart: string
  let dtEnd: string
  let allDay = false

  if (startTime) {
    dtStart = `${dateCompact}T${startTime.replace(':', '')}00`
    dtEnd = endTime ? `${dateCompact}T${endTime.replace(':', '')}00` : dtStart
  } else {
    // Journée entière — DTEND exclusif, donc le lendemain (convention RFC 5545).
    allDay = true
    const next = new Date(`${eventDate}T00:00:00`)
    next.setDate(next.getDate() + 1)
    const nextCompact = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    dtStart = dateCompact
    dtEnd = nextCompact
  }

  const now = new Date()
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AREGIE//Inscription//FR',
    'BEGIN:VEVENT',
    `UID:${dateCompact}-${Math.random().toString(36).slice(2)}@aregie.com`,
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
    allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
  link.click()
  URL.revokeObjectURL(url)
}
