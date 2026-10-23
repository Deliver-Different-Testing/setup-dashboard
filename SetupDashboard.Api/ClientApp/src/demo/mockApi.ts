// Demo build only (vite --mode demo): stands in for lib/api.ts so the real screens can be
// clicked through with sample data. Nothing leaves the browser. "Send" runs the same
// required-field rules as the backend step pushers and pretends the owning app accepted
// every complete row.
import type {
  ChecklistItem, LookupItem, Me, PushSummary, RowResult, Session, SessionSummary, StepKey, StepState, TrainingMember,
} from '../lib/api'

export type * from '../lib/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

let BASE_URL = '/api'
export function getApiBaseUrl() { return BASE_URL }
export function setApiBaseUrl(url: string) { BASE_URL = url }

const wait = <T,>(v: T, ms = 250) => new Promise<T>(r => setTimeout(() => r(structuredClone(v)), ms))
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const STEP_KEYS: StepKey[] = ['business', 'team', 'clients', 'rates', 'schedules', 'couriers', 'partners', 'automations', 'integrations', 'appconfig', 'training']

// ── Checklist, as Services/Steps/StepCatalog.cs seeds it ───────────────────────

const CHECKLISTS: Partial<Record<StepKey, ChecklistItem[]>> = {
  business: [
    { id: 'tenant-client-file', owner: 'DFRNT', required: true, item: "Tenant's own client file exists (client type Tenant). Staff and roles hang off it; there is no API to create it yet." },
    { id: 'tenant-identity', owner: 'DFRNT', required: true, link: '#', item: "System settings and email wording are this tenant's: company name, address, bank/tax, sender and reply addresses, sign-in invite and password-reset wording. New tenant databases can carry another tenant's values - check before anyone is invited." },
    { id: 'depots', owner: 'DFRNT', required: true, item: 'Depots created (needed by schedules, distance rates and fleets). Admin Manager only for now.' },
    { id: 'logo', owner: 'DFRNT', required: false, item: 'Tenant logo uploaded (no upload API yet).' },
  ],
  team: [{ id: 'role-actions', owner: 'DFRNT', required: false, link: '#', item: 'Role actions reviewed (View Financial Data, Manage Users, Edit Settings...). They follow each tile unless switched off; DF Admin sets them in Settings > Roles.' }],
  rates: [
    { id: 'rate-cards', owner: 'DFRNT', required: false, link: '#', item: 'Rate cards and spreadsheet import (DF Admin only in Settings).' },
    { id: 'speeds', owner: 'DFRNT', required: false, item: 'Speeds (services) the tenant sells exist. Settings can only copy an existing speed.' },
    { id: 'nz-zone-rates', owner: 'DFRNT', required: false, item: 'NZ tenants: bulk zone rates (no API yet).' },
  ],
  couriers: [{ id: 'fleet-assignment', owner: 'Tenant', required: false, link: '#', item: "Couriers assigned to their vehicle fleets in Settings > Driver List (courier create can't set the fleet)." }],
  automations: [{ id: 'automations', owner: 'Tenant', required: true, link: '#', item: 'Automation rules set up in Settings > Automations (notifications, auto-assign). Rules go live as soon as they are saved.' }],
  integrations: [{ id: 'integrations', owner: 'Tenant', required: true, link: '#', item: 'Integrations the tenant needs are connected in Integration Manager (carriers, Shopify, partners).' }],
  appconfig: [
    { id: 'admin-setup', owner: 'Tenant', required: false, link: '#', item: 'Admin Setup catalogues (note types, document types, quizzes).' },
    { id: 'dispatch-settings', owner: 'Tenant', required: false, link: '#', item: 'Dispatch settings and sign-up page.' },
    { id: 'consumer-booking', owner: 'Tenant', required: false, link: '#', item: 'Consumer / baggage delivery settings, if used.' },
  ],
}

const step = (key: StepKey, extra: Partial<StepState> = {}): StepState => ({
  key, status: 'not_started', requests: [], rows: [], checklist: structuredClone(CHECKLISTS[key] ?? []), updatedAt: daysAgo(1), ...extra,
})

// ── Sample tenant (every name below is an example) ─────────────────────────────

function sampleSession(): Session {
  const s: Session = {
    id: 'demo-session', tenantCode: 'example', currentStep: 2, status: 'active', createdByName: 'Sample DFRNT staff',
    createdAt: daysAgo(6), updatedAt: daysAgo(0),
    steps: Object.fromEntries(STEP_KEYS.map(k => [k, step(k)])) as Record<StepKey, StepState>,
    business: {
      companyName: 'Example Final Mile', legalName: 'Example Final Mile LLC', country: 'United States',
      geography: ['Kansas City', 'Fort Lauderdale'], verticals: ['Final mile', 'Retail'], currentSystem: 'Datatrac', deliveriesPerMonth: '6,000',
      primaryContact: { name: 'Sample Admin', email: 'admin@example.com', phone: '(555) 010 0100', title: 'Chief Executive Officer' },
    },
    team: {
      roles: [
        { name: 'Example Admin', description: 'Tenant administrator', tiles: ['hub-tile-configurator', 'hub-tile-despatchweb', 'hub-tile-booking', 'hub-tile-tracking', 'hub-tile-accounts', 'hub-tile-print', 'hub-tile-routed-operations', 'hub-tile-dfrntcrm'] },
        { name: 'Example Operations', description: 'Operations staff - everything except Accounts', tiles: ['hub-tile-configurator', 'hub-tile-despatchweb', 'hub-tile-booking', 'hub-tile-tracking', 'hub-tile-print', 'hub-tile-routed-operations', 'hub-tile-dfrntcrm'] },
      ],
      people: [
        { email: 'admin@example.com', firstName: 'Sample', lastName: 'Admin', jobTitle: 'Chief Executive Officer', roleName: 'Example Admin', inviteConfirmed: true },
        { email: 'ops@example.com', firstName: 'Sample', lastName: 'Dispatcher', roleName: 'Example Operations', inviteConfirmed: false },
      ],
    },
    clients: [
      { code: 'ACME', name: 'Acme Freight (example)', address: '1200 Main St', suburb: 'Kansas City', city: 'MO', postCode: '64105', latitude: 39.1, longitude: -94.58, invoiceScheduleId: 1, paymentTermId: 2, inviteConfirmed: true, primaryContact: { firstName: 'Avery', surname: 'Stone', email: 'avery@acme.example', createSignIn: false }, contacts: [] },
      { code: 'BLUEJAY', name: 'Bluejay Retail (example)', address: '45 Ocean Dr', suburb: 'Fort Lauderdale', city: 'FL', invoiceScheduleId: 1, inviteConfirmed: false, primaryContact: { firstName: 'Riley', email: 'riley@bluejay.example', createSignIn: false }, contacts: [] },
      { code: 'NORTHWIND', name: 'Northwind Pharmacy (example)', inviteConfirmed: false, primaryContact: { createSignIn: false }, contacts: [] },
    ],
    rates: {
      vehicleSizes: [{ name: 'Cargo van', weightCapacity: 1500, fuelPercent: 12 }],
      zoneGroups: [{ name: 'Kansas City', zones: [{ name: 'KC Zone 1', zips: ['64105', '64106', '64108'] }, { name: 'KC Zone 2', zips: ['64111', '64112'] }] }],
      fuelSurcharges: [{ name: 'Standard fuel', ratePercent: 14, start: '2026-11-01' }],
      zoneRates: [{ name: 'KC1 to KC2 van', fromZone: 'KC Zone 1', toZone: 'KC Zone 2', speedId: 1, vehicleSizeNames: ['Cargo van'], chargeRate: 28, driverRate: 17, clientCodes: [] }],
      distanceRates: [],
    },
    schedules: [{ name: 'KC weekday final mile', regionId: 1, originType: 'depot', pickupDepotId: 1, speedId: 1, clientCodes: [], dayWindows: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startTime: '09:00', endTime: '17:00', cutoffTime: '07:00' })) }],
    couriers: { fleets: [{ name: 'KC vans', depotId: 1 }], couriers: [{ email: 'driver1@example.com', firstName: 'Sample', surName: 'Driver', vehicleType: 'Van', fleetName: 'KC vans' }] },
    partners: [],
    training: [],
  }

  const tick = (k: StepKey, id: string) => { const c = s.steps[k].checklist.find(x => x.id === id); if (c) { c.doneAt = daysAgo(4); c.doneBy = 'Sample DFRNT staff' } }
  tick('business', 'tenant-client-file'); tick('business', 'depots')
  s.steps.business.status = 'in_progress'
  s.steps.team.status = 'in_progress'
  s.steps.team.rows = [
    row('role', 'Example Admin', 'created', { entityId: 9 }),
    row('role', 'Example Operations', 'created', { entityId: 10 }),
    row('person', 'admin@example.com', 'needs_data', { needs: ["Waiting for DFRNT to confirm the tenant's system settings and invite wording (Business step) - nobody is emailed before that."] }),
  ]
  s.steps.clients = { ...s.steps.clients, status: 'waiting_on_tenant', requests: [{ id: 'r1', item: 'Full customer list with addresses and billing contacts', requestedAt: daysAgo(3), requestedBy: 'Sample DFRNT staff', dueBy: daysAgo(-4) }] }
  s.steps.rates = { ...s.steps.rates, status: 'waiting_on_tenant', requests: [{ id: 'r2', item: 'Current rate sheet (zone and distance)', requestedAt: daysAgo(5), requestedBy: 'Sample DFRNT staff' }] }
  s.steps.schedules.status = 'in_progress'
  return s
}

function row(kind: string, key: string, status: RowResult['status'], extra: Partial<RowResult> = {}): RowResult {
  return { kind, key, status, needs: [], errors: [], updatedAt: daysAgo(1), ...extra }
}

let session = sampleSession()

// ── Required-field rules (mirror Services/Steps/*Pusher.cs) ────────────────────

const missing = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')
const INVITE_BLOCK = "Waiting for DFRNT to confirm the tenant's system settings and invite wording (Business step) - nobody is emailed before that."

function ledger(st: StepState) {
  return (kind: string, key: string) => {
    let r = st.rows.find(x => x.kind === kind && x.key.toLowerCase() === key.toLowerCase())
    if (!r) { r = row(kind, key, 'pending'); st.rows.push(r) }
    return r
  }
}
let nextId = 500
function settle(r: RowResult, needs: string[], notice?: string) {
  if (r.status === 'created') return
  r.updatedAt = new Date().toISOString()
  if (needs.length) { r.status = 'needs_data'; r.needs = needs; r.errors = []; return }
  r.status = 'created'; r.needs = []; r.errors = []; r.entityId = ++nextId; r.notice = notice
}

function push(key: StepKey) {
  const st = session.steps[key]
  const L = ledger(st)
  const identityOk = !!session.steps.business.checklist.find(c => c.id === 'tenant-identity')?.doneAt
  const us = true

  if (key === 'team') {
    const roleNames = session.team.roles.map(r => r.name?.trim()).filter(Boolean) as string[]
    for (const r of session.team.roles) {
      const rr = L('role', r.name || '(unnamed role)')
      settle(rr, missing(r.name) ? ['role name'] : [])
      for (const t of r.tiles) settle(L('tile', `${r.name} / ${t}`), [])
    }
    for (const p of session.team.people) {
      const n: string[] = []
      if (missing(p.email)) n.push('email')
      if (missing(p.firstName)) n.push('first name')
      if (missing(p.roleName)) n.push('role')
      else if (!roleNames.includes(p.roleName!.trim())) n.push(`a role called "${p.roleName}" on this step`)
      if (!p.inviteConfirmed) n.push("tick 'send sign-in invite' (creating the person emails them)")
      if (!identityOk) n.push(INVITE_BLOCK)
      settle(L('person', p.email || '(no email)'), n, 'Contact added. Hub login provisioned and an invite email was sent (demo - nothing was sent).')
    }
  }
  if (key === 'clients') {
    for (const c of session.clients) {
      const n: string[] = []
      if (missing(c.code)) n.push('client code')
      if (missing(c.name)) n.push('name')
      if (missing(c.address)) n.push('street address')
      if (missing(c.suburb)) n.push(us ? 'city' : 'suburb')
      if (missing(c.city)) n.push(us ? 'state' : 'city')
      if (c.invoiceScheduleId == null) n.push('invoice schedule')
      if (c.paymentTermId == null) n.push('payment term')
      if (missing(c.primaryContact.firstName)) n.push('primary contact first name')
      if (missing(c.primaryContact.email)) n.push('primary contact email')
      if (!c.inviteConfirmed) n.push("tick 'send sign-in invite' (creating the customer emails the primary contact)")
      if (!identityOk) n.push(INVITE_BLOCK)
      const geo = c.latitude == null || c.longitude == null ? ' No map position was given - set it on the customer in Settings before using client-address schedules.' : ''
      settle(L('client', c.code || c.name || '(no code)'), n, `Customer created. Hub sign-in invite sent to the contact (demo).${geo}`)
    }
  }
  if (key === 'rates') {
    for (const v of session.rates.vehicleSizes) settle(L('vehicle-size', v.name || '(unnamed vehicle size)'), missing(v.name) ? ['name'] : [])
    for (const g of session.rates.zoneGroups) {
      settle(L('zone-group', g.name || '(unnamed zone group)'), missing(g.name) ? ['name'] : [])
      for (const z of g.zones) {
        settle(L('zone', z.name || '(unnamed zone)'), missing(z.name) ? ['name'] : [])
        for (const zip of z.zips) settle(L('zip', `${z.name} / ${zip}`), [])
      }
    }
    for (const f of session.rates.fuelSurcharges) {
      const n: string[] = []
      if (f.ratePercent == null) n.push('fuel %')
      if (missing(f.start)) n.push('start date')
      settle(L('fuel-surcharge', f.name || `Fuel ${f.ratePercent}%`), n)
    }
    for (const r of session.rates.zoneRates) {
      const n: string[] = []
      if (missing(r.name)) n.push('name')
      if (missing(r.fromZone)) n.push('from zone')
      if (missing(r.toZone)) n.push('to zone')
      if (r.speedId == null) n.push('speed')
      if (r.vehicleSizeNames.length === 0) n.push('at least one vehicle size')
      if (r.chargeRate == null) n.push('customer charge')
      if (r.driverRate == null) n.push('driver rate')
      settle(L('zone-rate', r.name || '(unnamed zone rate)'), n, r.clientCodes.length === 0 ? 'Applies to every customer.' : undefined)
    }
    for (const r of session.rates.distanceRates) {
      const n: string[] = []
      if (missing(r.name)) n.push('name')
      if (r.speedId == null) n.push('speed')
      if (r.vehicleSizeNames.length === 0) n.push('at least one vehicle size')
      for (const [v, label] of [[r.baseCharge, 'base charge'], [r.baseChargeDriver, 'base charge (driver)'], [r.perDistanceUnit, 'per distance unit'], [r.perDistanceUnitDriver, 'per distance unit (driver)'], [r.distanceIncluded, 'distance included']] as const)
        if (v == null) n.push(label)
      settle(L('distance-rate', r.name || '(unnamed distance rate)'), n, r.clientCodes.length === 0 ? 'Applies to every customer.' : undefined)
    }
  }
  if (key === 'schedules') {
    for (const s of session.schedules) {
      const n: string[] = []
      if (missing(s.name)) n.push('name')
      if (s.regionId == null) n.push('destination depot')
      if (missing(s.originType)) n.push('origin (depot, client address or direct)')
      if (s.dayWindows.length === 0) n.push('at least one day window')
      s.dayWindows.forEach((w, i) => {
        if (!w.startTime) n.push(`start time (HH:mm) for window ${i + 1}`)
        if (!w.endTime) n.push(`end time (HH:mm) for window ${i + 1}`)
      })
      if (s.originType === 'client') {
        if (s.originRegionId == null) n.push('origin depot (client-address schedules)')
        if (s.clientCodes.length === 0) n.push("at least one customer (client-address schedules can't be the default)")
      }
      if (s.originType === 'depot' && s.pickupDepotId == null) n.push('pickup depot')
      settle(L('schedule', s.name || '(unnamed schedule)'), n, s.clientCodes.length === 0 ? 'Default schedule: applies to every customer.' : undefined)
    }
  }
  if (key === 'couriers') {
    for (const f of session.couriers.fleets) settle(L('fleet', f.name || '(unnamed fleet)'), missing(f.name) ? ['name'] : [])
    for (const c of session.couriers.couriers) {
      const n: string[] = []
      if (missing(c.firstName)) n.push('first name')
      if (missing(c.surName)) n.push('surname')
      if (missing(c.email)) n.push('email (their app sign-in)')
      if (!c.hasInitialPassword && (!c.initialPassword || c.initialPassword.length < 8)) n.push('initial app password (8+ characters)')
      const r = L('courier', c.email || '(unnamed courier)')
      settle(r, n, c.fleetName ? `Assign to fleet "${c.fleetName}" in Settings > Driver List.` : undefined)
      if (r.status === 'created') { c.initialPassword = undefined; c.hasInitialPassword = false }
    }
  }
  if (key === 'partners') {
    for (const p of session.partners) {
      const n: string[] = []
      if (missing(p.name)) n.push('name')
      if (!missing(p.contactEmail)) {
        if (p.primaryContactRoleId == null) n.push("role for the partner's contact")
        if (!p.inviteConfirmed) n.push("tick 'send sign-in invite' (the contact is emailed)")
        if (!identityOk) n.push(INVITE_BLOCK)
      }
      settle(L('partner', p.name || '(unnamed partner)'), n)
    }
  }
  recompute(key, true)
  const rows = st.rows
  return { created: rows.filter(r => r.status === 'created').length, needsData: rows.filter(r => r.status === 'needs_data').length, failed: rows.filter(r => r.status === 'failed').length, signInExpired: false } as PushSummary
}

function recompute(key: StepKey, hasData: boolean) {
  const st = session.steps[key]
  if (st.requests.some(r => !r.fulfilledAt)) st.status = 'waiting_on_tenant'
  else if (st.status === 'done') { /* stays */ }
  else if (hasData || st.rows.length || st.checklist.some(c => c.doneAt)) st.status = 'in_progress'
  else st.status = 'not_started'
  st.updatedAt = new Date().toISOString()
  session.updatedAt = st.updatedAt
}

function completeBlocker(key: StepKey) {
  const st = session.steps[key]
  if (st.requests.some(r => !r.fulfilledAt)) return 'There are open requests to the tenant.'
  const bad = st.rows.filter(r => r.status !== 'created' && r.status !== 'skipped').length
  if (bad) return `${bad} record(s) are not created yet.`
  const open = st.checklist.filter(c => c.required && !c.doneAt).length
  if (open) return `Required checklist items are open: ${open}.`
  return null
}

/** The browser never gets courier passwords back - same as SetupController.View. */
function view(): Session {
  const s = structuredClone(session)
  s.couriers.couriers = s.couriers.couriers.map(c => ({ ...c, hasInitialPassword: !!c.initialPassword || !!c.hasInitialPassword, initialPassword: undefined }))
  return s
}

// ── The API surface ────────────────────────────────────────────────────────────

const me: Me = { success: true, tenantId: '7', tenantCode: 'example', clientTypeId: 5, isDfAdmin: true, isUsTenant: true, name: 'Sample DFRNT staff' }

export const validateLogin = () => wait(me, 300)
export const listSessions = () => wait<{ sessions: SessionSummary[] }>({
  sessions: [{ id: session.id, currentStep: session.currentStep, companyName: session.business.companyName, createdByName: session.createdByName, status: session.status, waitingOnTenant: 2, stepsDone: 0, createdAt: session.createdAt, updatedAt: session.updatedAt }],
})
export const createSession = () => { session = sampleSession(); return wait({ session: view() }) }
export const getSession = () => wait({ session: view() })
export const deleteSession = () => wait({ success: true })
export const setCurrentStep = (_id: string, s: number) => { session.currentStep = s; return wait({}) }

export const saveStepData = (_id: string, key: StepKey, data: unknown) => {
  const d = structuredClone(data) as never
  if (key === 'business') session.business = d
  else if (key === 'team') session.team = d
  else if (key === 'clients') session.clients = d
  else if (key === 'rates') session.rates = d
  else if (key === 'schedules') session.schedules = d
  else if (key === 'partners') session.partners = d
  else if (key === 'couriers') {
    const incoming = d as Session['couriers']
    for (const c of incoming.couriers) {
      if (!c.initialPassword) {
        const prior = session.couriers.couriers.find(p => p.email?.toLowerCase() === c.email?.toLowerCase())
        c.initialPassword = prior?.initialPassword
        c.hasInitialPassword = prior?.hasInitialPassword
      }
    }
    session.couriers = incoming
  }
  recompute(key, true)
  return wait({ session: view() })
}

export const pushStep = (_id: string, key: StepKey) => {
  const summary = push(key)
  return wait({ session: view(), summary }, 700)
}

export const addRequest = (_id: string, key: StepKey, item: string, dueBy?: string) => {
  session.steps[key].requests.push({ id: Math.random().toString(36).slice(2, 10), item, requestedAt: new Date().toISOString(), requestedBy: me.name, dueBy })
  recompute(key, false)
  return wait({ session: view() })
}
export const fulfilRequest = (_id: string, key: StepKey, requestId: string) => {
  const r = session.steps[key].requests.find(x => x.id === requestId)
  if (r) { r.fulfilledAt = new Date().toISOString(); r.fulfilledBy = me.name }
  recompute(key, false)
  return wait({ session: view() })
}
export const tickChecklist = (_id: string, key: StepKey, itemId: string, done: boolean) => {
  const c = session.steps[key].checklist.find(x => x.id === itemId)
  if (c) { c.doneAt = done ? new Date().toISOString() : undefined; c.doneBy = done ? me.name : undefined }
  recompute(key, false)
  return wait({ session: view() })
}
export const completeStep = (_id: string, key: StepKey) => {
  const why = completeBlocker(key)
  if (why) return Promise.reject(new ApiError(why, 409))
  const st = session.steps[key]
  st.status = 'done'; st.completedAt = new Date().toISOString(); st.completedBy = me.name
  return wait({ session: view() })
}
export const reopenStep = (_id: string, key: StepKey) => {
  const st = session.steps[key]
  st.status = 'in_progress'; st.completedAt = undefined; st.completedBy = undefined
  recompute(key, false)
  return wait({ session: view() })
}

// Deliberately shows another tenant's details, the way a newly copied tenant database can.
export const getTenantSummary = () => wait({
  settings: { CompanyAddress: 'PO Box 1000, Sample Street, Auckland 1010', AdminEmail: 'helpdesk@another-tenant.example', CountryCode: '', ApplicationName: 'Mercury' },
  counts: { Clients: 0, Team: 9, Couriers: 2, Zones: 0, Automations: 0 },
})
export const getTenantLogo = () => wait({ success: false, logoUrl: null })

const LOOKUPS: Record<string, unknown> = {
  tiles: [
    ['hub-tile-configurator', 'Settings'], ['hub-tile-despatchweb', 'Dispatch'], ['hub-tile-routeviewer', 'Route Viewer'],
    ['hub-tile-couriermanager', 'Courier Manager'], ['hub-tile-booking', 'Booking'], ['hub-tile-tracking', 'Job Search'],
    ['hub-tile-accounts', 'Accounts'], ['hub-tile-print', 'Print'], ['hub-tile-fuel-surcharge', 'Fuel Surcharge'],
    ['hub-tile-routed-operations', 'Routed Operations'], ['hub-tile-dfrntcrm', 'Customer Success Platform'],
    ['hub-tile-integration-manager', 'Integration Manager', 'not open to Tenant yet'],
  ].map(([featureKey, displayName, condition]) => ({ featureKey, displayName, condition: condition ?? null })),
  'invoice-schedules': { options: [{ id: 1, name: 'Monthly' }, { id: 2, name: 'Weekly' }, { id: 3, name: 'Fortnightly' }], defaultId: 1 },
  'payment-terms': { options: [{ id: 1, name: 'Due on receipt' }, { id: 2, name: '20th of the following month' }, { id: 3, name: 'Net 30' }], defaultId: 3 },
  depots: [{ id: 1, name: 'Kansas City' }, { id: 2, name: 'Fort Lauderdale' }],
  speeds: [{ id: 1, name: 'Same day' }, { id: 2, name: 'Next day' }, { id: 3, name: 'Scheduled final mile' }],
  'vehicle-sizes': [{ id: 3, name: 'Box truck' }],
  'zone-names': [],
  'zone-groups': [],
  'partner-roles': [{ id: 21, name: 'NpAdmin' }, { id: 22, name: 'NpDispatcher' }, { id: 23, name: 'NpReadOnly' }],
  'tenant-roles': [],
}
export const lookup = <T = LookupItem[]>(name: string) =>
  name in LOOKUPS ? wait(LOOKUPS[name] as T, 150) : Promise.reject(new ApiError(`No lookup called '${name}'.`, 404))

export const validate = () => wait({ available: true as boolean | null })

export const getTraining = () => wait({ progress: session.training })
export const saveTraining = (_id: string, members: TrainingMember[]) => { session.training = structuredClone(members); return wait({}) }
export const completeChallenge = (_id: string, userEmail: string, challengeId: string, xpEarned: number) => {
  const m = session.training.find(x => x.userEmail === userEmail)
  if (m && !m.completedChallenges.includes(challengeId)) { m.completedChallenges.push(challengeId); m.xp += xpEarned }
  return wait({})
}
export const getLeaderboard = () => wait({ leaderboard: [] as unknown[] })

// Smart Import talks to the server directly; there is no server in the demo.
const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/setup/import/'))
    return Promise.resolve(new Response(JSON.stringify({ success: false, message: "File import isn't available in this demo - in the real app it maps your file's columns and loads the rows into this step." }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  return realFetch(input, init)
}
