import type { ApiResult } from '@/lib/api'
import {
  DEMO_ADMIN_AUTH,
  DEMO_CITIZEN,
  DEMO_FORMATIONS,
  DEMO_INVOICE,
  DEMO_MONTH_STATS,
  DEMO_SERVICE_LOOKUP,
  DEMO_TARIFFS,
  buildRegistrationCitizen,
  emailExample,
} from './fixtures'

// Résolveur d'API pour le build "démo statique" (VITE_STATIC_DEMO=true,
// voir src/lib/api.ts) : aucun réseau, tout est répondu depuis des données
// figées. Ne couvre que les parcours montrables en démo commerciale
// (dashboard, billetterie citoyen, inscription citoyen, facture citoyen,
// scanner — déjà local, galerie d'emails) ; un endpoint non reconnu répond
// une valeur neutre plutôt que de planter la page (voir `fallback`).

function ok<T>(data: T, status = 200): ApiResult<T> {
  return { ok: true, status, data }
}

function fail<T = unknown>(status: number, data: T): ApiResult<T> {
  return { ok: false, status, data }
}

// L'accessToken/idop est notre seule mémoire entre deux requêtes (pas de
// backend) — on y encode ce qu'il faut pour reconstruire la réponse
// suivante (billets, inscription…). Jamais une vraie preuve de possession
// ici, seulement un porteur de données pour la démo.
function encodeToken(payload: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(payload)))
}
function decodeToken<T>(token: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(atob(token))) as T
  } catch {
    return null
  }
}

function qs(path: string): URLSearchParams {
  const i = path.indexOf('?')
  return new URLSearchParams(i === -1 ? '' : path.slice(i + 1))
}
function pathname(path: string): string {
  const i = path.indexOf('?')
  return i === -1 ? path : path.slice(0, i)
}

function slugFromLookup(slug: string) {
  return DEMO_SERVICE_LOOKUP[slug]
}

interface OtpTokenPayload {
  quantities?: Record<string, number>
  visitDate?: string
  formationId?: number
  firstName?: string
  lastName?: string
  email?: string
}

export function resolveDemoApi(
  method: string,
  rawPath: string,
  options: { body?: unknown }
): ApiResult {
  const path = pathname(rawPath)
  const params = qs(rawPath)
  const body = (options.body ?? {}) as Record<string, unknown>
  const m = method.toUpperCase()

  // --- Widget démo / bootstrap ---------------------------------------
  if (m === 'GET' && path === '/demo/status') return ok({ data: { enabled: true } })
  if (m === 'GET' && path === '/demo/config') {
    return ok({
      data: {
        journeys: {
          billetterie: '/billetterie/piscine-municipale-a',
          inscription: '/inscription/inscriptions-formations',
          factures: '/factures/facturation-hopital?demoRef=DEMO-2026-001&demoYear=2026&demoAmount=187.50',
        },
        citizen: DEMO_CITIZEN,
      },
    })
  }
  if (m === 'POST' && path === '/demo/admin-login') return ok({ data: DEMO_ADMIN_AUTH })
  if (m === 'GET' && path === '/demo/example-email') {
    const example = emailExample(params.get('template') ?? '')
    return ok({ data: { template: params.get('template') ?? '', subject: example.subject, html: example.html } })
  }

  // --- Session organisme -----------------------------------------------
  if (m === 'POST' && path === '/auth/refresh') return ok({ data: DEMO_ADMIN_AUTH })
  if (m === 'GET' && path === '/billetterie/orders/stats') return ok({ data: DEMO_MONTH_STATS })
  if (m === 'GET' && path === '/inscription/pending-review-count') return ok({ data: { count: 0, events: [] } })
  if (m === 'GET' && path === '/billetterie/scans') return ok({ data: [] })

  // --- Billetterie citoyen ---------------------------------------------
  const billetterieLookup = path.match(/^\/billetterie\/services\/lookup\/([^/]+)$/)
  if (m === 'GET' && billetterieLookup) {
    const svc = slugFromLookup(billetterieLookup[1])
    return svc ? ok({ data: svc }) : fail(404, { error: 'service_not_found' })
  }
  if (m === 'GET' && path === '/billetterie/tariffs') return ok({ data: DEMO_TARIFFS })
  if (m === 'POST' && path === '/billetterie/otp/request') return ok({ data: { devCode: '123456' } })
  if (m === 'POST' && path === '/billetterie/otp/verify') return ok({ data: {} })
  if (m === 'POST' && path === '/billetterie/orders') {
    const quantities: Record<string, number> = {}
    const tickets = (body.tickets as { tariffType: string; quantity: number }[] | undefined) ?? []
    for (const t of tickets) quantities[t.tariffType] = t.quantity
    const paymentReference = `BILL0000010000000${Math.floor(Math.random() * 9) + 1}`
    const accessToken = encodeToken({ quantities, visitDate: String(body.visitDate ?? '') } satisfies OtpTokenPayload)
    return ok({
      data: {
        orderId: 1,
        paymentReference,
        accessToken,
        status: 'confirmed',
        free: true,
        message: 'Réservation confirmée — vos billets vous ont été envoyés.',
      },
    })
  }
  const orderTickets = path.match(/^\/billetterie\/orders\/by-reference\/([^/]+)\/tickets$/)
  if (m === 'GET' && orderTickets) {
    const decoded = decodeToken<OtpTokenPayload>(params.get('idop') ?? '')
    const quantities = decoded?.quantities ?? { 'Plein tarif': 1 }
    const visitDate = decoded?.visitDate ?? new Date().toISOString().slice(0, 10)
    let id = 1
    const ticketsOut: unknown[] = []
    for (const [tariffType, qty] of Object.entries(quantities)) {
      const tariff = DEMO_TARIFFS.find((t) => t.tariffType === tariffType) ?? DEMO_TARIFFS[0]
      for (let i = 0; i < qty; i++) {
        ticketsOut.push({
          id: id,
          tariffType,
          priceAtPurchaseCents: tariff.priceCents,
          visitDate,
          status: 'issued',
          code: `${id}.demo`,
        })
        id++
      }
    }
    return ok({ data: { tickets: ticketsOut, orderCode: `ORD${orderTickets[1]}.demo` } })
  }

  // --- Facture citoyenne -------------------------------------------------
  const facturesLookup = path.match(/^\/factures\/services\/lookup\/([^/]+)$/)
  if (m === 'GET' && facturesLookup) {
    const svc = slugFromLookup(facturesLookup[1])
    return svc ? ok({ data: svc }) : fail(404, { error: 'service_not_found' })
  }
  if (m === 'POST' && path === '/factures/otp/request') return ok({ data: { devCode: '123456' } })
  if (m === 'POST' && path === '/factures/otp/verify') return ok({ data: {} })
  if (m === 'POST' && path === '/factures/verify') {
    const matches =
      body.hospitalReference === DEMO_INVOICE.hospitalReference &&
      Number(body.fiscalYear) === DEMO_INVOICE.fiscalYear &&
      Number(body.amountCents) === DEMO_INVOICE.amountCents
    if (!matches) return fail(404, { error: 'invoice_not_found' })
    return ok({
      data: {
        code: 'FACT00000600000001',
        status: 'draft',
        amountCents: DEMO_INVOICE.amountCents,
        objectLabel: DEMO_INVOICE.objectLabel,
        clientNumber: DEMO_INVOICE.clientNumber,
        fiscalYear: DEMO_INVOICE.fiscalYear,
      },
    })
  }
  const facturesPay = path.match(/^\/factures\/([^/]+)\/pay$/)
  if (m === 'POST' && facturesPay) {
    const email = String(body.payerEmail ?? DEMO_CITIZEN.email)
    const paymentUrl = `/factures/facturation-hopital/retour?idop=demo-paid&orgId=2&sourceReference=${facturesPay[1]}&status=paid&payerEmail=${encodeURIComponent(email)}`
    return ok({ data: { paymentUrl } })
  }
  const facturesByRef = path.match(/^\/factures\/by-reference\/([^/]+)$/)
  if (m === 'GET' && facturesByRef) {
    return ok({
      data: {
        code: facturesByRef[1],
        status: 'paid',
        amountCents: DEMO_INVOICE.amountCents,
        objectLabel: DEMO_INVOICE.objectLabel,
        clientNumber: DEMO_INVOICE.clientNumber,
        fiscalYear: DEMO_INVOICE.fiscalYear,
        payerEmail: params.get('payerEmail') ?? DEMO_CITIZEN.email,
        collectedAt: new Date().toISOString(),
      },
    })
  }

  // --- Inscription citoyenne ---------------------------------------------
  const inscriptionLookup = path.match(/^\/inscription\/services\/lookup\/([^/]+)$/)
  if (m === 'GET' && inscriptionLookup) {
    const svc = slugFromLookup(inscriptionLookup[1])
    return svc ? ok({ data: svc }) : fail(404, { error: 'service_not_found' })
  }
  if (m === 'GET' && path === '/inscription/events') return ok({ data: DEMO_FORMATIONS })
  const inscriptionBySlug = path.match(/^\/inscription\/events\/by-slug\/([^/]+)$/)
  if (m === 'GET' && inscriptionBySlug) {
    const formation = DEMO_FORMATIONS.find((f) => f.slug === inscriptionBySlug[1])
    return formation ? ok({ data: formation }) : fail(404, { error: 'event_not_found' })
  }
  if (m === 'POST' && path === '/inscription/otp/request') return ok({ data: { devCode: '123456' } })
  if (m === 'POST' && path === '/inscription/otp/verify') return ok({ data: {} })
  if (m === 'POST' && path === '/inscription/registrations') {
    const accessToken = encodeToken({
      formationId: Number(body.eventId),
      firstName: String(body.firstName ?? ''),
      lastName: String(body.lastName ?? ''),
      email: String(body.email ?? ''),
    } satisfies OtpTokenPayload)
    return ok({ data: { registrationId: 9001, status: 'confirmed', accessToken } })
  }
  const registrationByToken = path.match(/^\/inscription\/registrations\/by-token\/([^/]+)$/)
  if (m === 'GET' && registrationByToken) {
    const decoded = decodeToken<OtpTokenPayload>(registrationByToken[1])
    const formation = DEMO_FORMATIONS.find((f) => f.id === decoded?.formationId) ?? DEMO_FORMATIONS[0]
    return ok({
      data: buildRegistrationCitizen(
        formation,
        decoded?.firstName ?? DEMO_CITIZEN.firstName,
        decoded?.lastName ?? DEMO_CITIZEN.lastName,
        decoded?.email ?? DEMO_CITIZEN.email
      ),
    })
  }

  // --- Repli neutre : n'importe quel autre endpoint (Services/Vente/
  // Historique/Utilisateurs, uploads…) ne doit jamais planter une page,
  // seulement afficher un état vide. ---------------------------------
  if (m === 'GET') return ok({ data: [] })
  return ok({ data: {} })
}
