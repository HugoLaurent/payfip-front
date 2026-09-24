import type { Agent } from './types'

export function agentName(agent: Agent): string | null {
  if (!agent.firstName && !agent.lastName) return null
  return [agent.firstName, agent.lastName].filter(Boolean).join(' ')
}

export function agentInitials(agent: Agent): string {
  const name = agentName(agent)
  if (!name) return agent.email.slice(0, 2).toUpperCase()
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Jamais connecté'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "Connecté à l'instant"
  if (diffMin < 60) return `Connecté il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Connecté il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `Connecté il y a ${diffD} j`
  return `Dernière connexion le ${new Date(iso).toLocaleDateString('fr-FR')}`
}
