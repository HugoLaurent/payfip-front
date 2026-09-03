import type { AuthState, Formation, RegistrationCitizen, ServiceLookup } from '@/lib/types'
import { EMAIL_FIXTURES } from './emailFixtures'

// Toutes les données de ce fichier sont fictives — org/services calqués sur
// svc-auth/database/seeders/demo_seeder.ts ("AREGIE Demo Mixte") pour rester
// cohérentes avec le reste du mode démo, mais aucun appel réseau réel n'a
// lieu en build VITE_STATIC_DEMO (voir src/lib/api.ts).

export const DEMO_CITIZEN = { email: 'jean.dupont@exemple.test', firstName: 'Jean', lastName: 'Dupont' }

export const DEMO_ADMIN_AUTH: AuthState = {
  token: 'demo-static-token',
  userId: 5,
  orgId: 2,
  orgName: 'AREGIE Demo Mixte',
  email: 'admin@aregie-demo-mixte.test',
  firstName: null,
  lastName: null,
  role: 'admin',
  passwordChangeRequired: false,
  services: [
    {
      id: 4,
      name: 'Piscine Municipale A',
      serviceType: 'billetterie',
      numcli: '095548',
      permissions: { canSell: true, canScan: true, canManageTariffs: true, canViewHistory: true, canToggleService: true },
    },
    {
      id: 5,
      name: 'Piscine Municipale B',
      serviceType: 'billetterie',
      numcli: '006271',
      permissions: { canSell: true, canScan: true, canManageTariffs: true, canViewHistory: true, canToggleService: true },
    },
    {
      id: 6,
      name: 'Facturation Hôpital',
      serviceType: 'factures',
      numcli: '095548',
      permissions: { canSell: true, canScan: true, canManageTariffs: true, canViewHistory: true, canToggleService: true },
    },
    {
      id: 7,
      name: 'Inscriptions Formations',
      serviceType: 'inscription',
      numcli: '095548',
      permissions: { canSell: true, canScan: true, canManageTariffs: true, canViewHistory: true, canToggleService: true },
    },
  ],
}

export const DEMO_SERVICE_LOOKUP: Record<string, ServiceLookup> = {
  'piscine-municipale-a': {
    orgId: 2,
    serviceId: 4,
    name: 'Piscine Municipale A',
    serviceType: 'billetterie',
    isOpen: true,
    reopensAt: null,
    closedReason: null,
    closedMessage: null,
    openingDays: null,
    closures: [],
  },
  'facturation-hopital': {
    orgId: 2,
    serviceId: 6,
    name: 'Facturation Hôpital',
    serviceType: 'factures',
    isOpen: true,
    reopensAt: null,
    closedReason: null,
    closedMessage: null,
    openingDays: null,
    closures: [],
  },
  'inscriptions-formations': {
    orgId: 2,
    serviceId: 7,
    name: 'Inscriptions Formations',
    serviceType: 'inscription',
    isOpen: true,
    reopensAt: null,
    closedReason: null,
    closedMessage: null,
    openingDays: null,
    closures: [],
  },
}

export const DEMO_TARIFFS = [
  { id: 1, tariffType: 'Plein tarif', priceCents: 500 },
  { id: 2, tariffType: 'Tarif réduit', priceCents: 300 },
  { id: 3, tariffType: 'Enfant (-12 ans)', priceCents: 0 },
]

function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Reprend les formations du seeder svc-inscription (mêmes titres/tarifs) —
// jamais de justificatif requis ici : le happy path démo reste toujours
// "inscription -> confirmée" sans révision agent à simuler.
export const DEMO_FORMATIONS: Formation[] = [
  {
    id: 101,
    slug: 'natation-adultes-debutant',
    type: 'formation',
    title: 'Natation adultes — niveau débutant',
    description:
      "Dix séances d'une heure pour apprendre ou reprendre confiance dans l'eau, encadrées par un maître-nageur. Petit groupe, tous niveaux acceptés.",
    eventDate: inDays(12),
    startTime: null,
    endTime: null,
    timeLabel: 'Mardis 18h30 – 19h30',
    location: 'Piscine Municipale A',
    category: 'Sport',
    registrationDeadline: null,
    priceCents: 4500,
    documentRequirements: null,
    capacity: 12,
    maxParticipantsPerRegistration: 1,
    formSchema: null,
    seatsRemaining: 5,
    isFull: false,
  },
  {
    id: 102,
    slug: 'premiers-secours-psc1',
    type: 'formation',
    title: 'Premiers secours — PSC1',
    description: 'Formation certifiante aux gestes qui sauvent, une journée complète.',
    eventDate: inDays(21),
    startTime: null,
    endTime: null,
    timeLabel: '9h – 17h',
    location: 'Salle municipale',
    category: 'Santé',
    registrationDeadline: null,
    priceCents: 3500,
    documentRequirements: null,
    capacity: 10,
    maxParticipantsPerRegistration: 1,
    formSchema: null,
    seatsRemaining: 3,
    isFull: false,
  },
  {
    id: 103,
    slug: 'reunion-publique-mediatheque',
    type: 'evenement',
    title: 'Réunion publique — projet de médiathèque',
    description:
      "Présentation du projet de médiathèque par l'équipe municipale, suivie d'un temps d'échange avec les habitants.",
    eventDate: inDays(9),
    startTime: null,
    endTime: null,
    timeLabel: '18h30 – 20h',
    location: 'Salle du conseil',
    category: 'Citoyenneté',
    registrationDeadline: null,
    priceCents: 0,
    documentRequirements: null,
    capacity: null,
    maxParticipantsPerRegistration: 6,
    formSchema: null,
    seatsRemaining: null,
    isFull: false,
  },
  {
    id: 104,
    slug: 'atelier-informatique-seniors',
    type: 'formation',
    title: 'Atelier informatique — seniors',
    description: "Prise en main du courrier électronique et des démarches administratives en ligne.",
    eventDate: inDays(6),
    startTime: null,
    endTime: null,
    timeLabel: '14h – 16h',
    location: 'Médiathèque',
    category: 'Numérique',
    registrationDeadline: null,
    priceCents: 0,
    documentRequirements: null,
    capacity: 1,
    maxParticipantsPerRegistration: 1,
    formSchema: null,
    seatsRemaining: 0,
    isFull: true,
  },
  {
    id: 105,
    slug: 'concert-choeur-municipal',
    type: 'evenement',
    title: "Concert de fin d'année — chœur municipal",
    description: 'Le chœur municipal clôture sa saison avec un répertoire de chants populaires. Entrée gratuite.',
    eventDate: inDays(30),
    startTime: null,
    endTime: null,
    timeLabel: '20h30',
    location: 'Salle des fêtes',
    category: 'Culture',
    registrationDeadline: null,
    priceCents: 0,
    documentRequirements: null,
    capacity: 80,
    maxParticipantsPerRegistration: 8,
    formSchema: null,
    seatsRemaining: 62,
    isFull: false,
  },
]

export const DEMO_INVOICE = {
  hospitalReference: 'DEMO-2026-001',
  fiscalYear: 2026,
  amountCents: 18750,
  objectLabel: 'Frais de séjour — chambre 204',
  clientNumber: '095548-00042',
}

export function buildRegistrationCitizen(formation: Formation, firstName: string, lastName: string, email: string): RegistrationCitizen {
  return {
    id: 9001,
    status: 'confirmed',
    eventId: formation.id,
    eventTitle: formation.title,
    eventDate: formation.eventDate,
    firstName,
    lastName,
    email,
    quantity: 1,
    amountCents: formation.priceCents,
    paymentMethod: 'free',
    registrationReference: `INS${String(formation.id).padStart(6, '0')}00000001`,
    rejectionReason: null,
    reviewedByLabel: null,
    reviewedAt: null,
    documentDeadlineAt: null,
    keepExistingDocuments: false,
    documentRequirements: null,
    waitlistPosition: null,
    waitlistNotifiedAt: null,
    waitlistResponseDeadline: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    canCancel: false,
    canPay: false,
    canConfirmWaitlistOffer: false,
    canRetryPayment: false,
    canReplaceDocuments: false,
    canDownloadAttestation: false,
  }
}

export function emailExample(template: string) {
  return EMAIL_FIXTURES[template] ?? EMAIL_FIXTURES.otp_code
}

export const DEMO_MONTH_STATS = {
  monthRevenueCents: 5200,
  monthTicketsSold: 5,
  monthTicketsScanned: 2,
  prevMonthRevenueCents: 3800,
  dailyRevenue: [400, 0, 800, 200, 1200, 0, 600, 0, 0, 1000, 400, 0, 600, 0].map((c, i) => ({
    date: inDays(i - 13),
    revenueCents: c,
  })),
  topServices: [
    { serviceId: 4, revenueCents: 4000, ticketsSold: 4 },
    { serviceId: 5, revenueCents: 1200, ticketsSold: 1 },
  ],
  recentActivity: [
    { type: 'order' as const, serviceId: 4, createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(), ticketCount: 2, amountCents: 2000, paymentReference: 'BILL00000100000005' },
    { type: 'scan' as const, serviceId: 4, createdAt: new Date(Date.now() - 6 * 3600_000).toISOString() },
    { type: 'order' as const, serviceId: 5, createdAt: new Date(Date.now() - 22 * 3600_000).toISOString(), ticketCount: 1, amountCents: 1200, paymentReference: 'BILL00000200000001' },
    { type: 'order' as const, serviceId: 4, createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(), ticketCount: 1, amountCents: 0, paymentReference: 'BILL00000100000004' },
  ],
}
