// Setup Dashboard API client.
//
// Everything goes to this app's own backend (same origin, Hub cookie). The backend
// forwards writes to Settings / Routed Ops as the signed-in person - the browser
// never calls those apps directly, and never chooses which tenant it is writing to.

let BASE_URL = import.meta.env.VITE_API_URL || '/api'

export function getApiBaseUrl() { return BASE_URL }
export function setApiBaseUrl(url: string) { BASE_URL = url }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // /API/Login lives at the app root, beside /api.
  const url = path.startsWith('/API/') ? `${BASE_URL.replace(/\/api$/i, '')}${path}` : `${BASE_URL}${path}`
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(options.headers || {}) },
  })
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!res.ok) {
    const b = (body ?? {}) as { message?: string; error?: string }
    const msg = b.message || b.error || (res.status === 401 ? 'Your sign-in has expired. Refresh the page.' : `Request failed (${res.status})`)
    throw new ApiError(msg, res.status)
  }
  return body as T
}

const json = (b: unknown) => JSON.stringify(b)

// ── Types (mirror Models/Session.cs) ─────────────────────────────────────────

export type StepKey =
  | 'business' | 'team' | 'clients' | 'rates' | 'schedules' | 'couriers'
  | 'partners' | 'automations' | 'integrations' | 'appconfig' | 'training'

export type StepStatus = 'not_started' | 'waiting_on_tenant' | 'in_progress' | 'done'
export type RowStatus = 'pending' | 'needs_data' | 'created' | 'failed' | 'skipped'

export interface DataRequest { id: string; item: string; requestedAt: string; requestedBy?: string; dueBy?: string; fulfilledAt?: string; fulfilledBy?: string }
export interface RowResult { key: string; kind: string; status: RowStatus; entityId?: number; needs: string[]; errors: string[]; notice?: string; updatedAt: string }
export interface ChecklistItem { id: string; item: string; owner: 'DFRNT' | 'Tenant'; link?: string; required: boolean; doneAt?: string; doneBy?: string }
export interface StepState { key: StepKey; status: StepStatus; requests: DataRequest[]; rows: RowResult[]; checklist: ChecklistItem[]; completedAt?: string; completedBy?: string; updatedAt: string }

export interface ContactInfo { name?: string; email?: string; phone?: string; title?: string }
export interface BusinessProfile {
  companyName?: string; legalName?: string; country?: string; geography: string[]; verticals: string[]
  currentSystem?: string; deliveriesPerMonth?: string; registrationNumber?: string; stateOfIncorporation?: string
  businessType?: string; primaryContact: ContactInfo
}

export interface RoleRow { name?: string; description?: string; tiles: string[] }
export interface PersonRow { email?: string; firstName?: string; lastName?: string; jobTitle?: string; mobile?: string; roleName?: string; inviteConfirmed: boolean }
export interface TeamStep { roles: RoleRow[]; people: PersonRow[] }

export interface ClientContactRow { firstName?: string; surname?: string; email?: string; mobile?: string; jobTitle?: string; createSignIn: boolean }
export interface ClientRow {
  code?: string; name?: string; address?: string; unit?: string; suburb?: string; city?: string; postCode?: string; country?: string
  latitude?: number; longitude?: number; phone?: string; email?: string; invoiceEmail?: string
  invoiceScheduleId?: number; paymentTermId?: number; invoiceMethod?: string; notes?: string
  inviteConfirmed: boolean; primaryContact: ClientContactRow; contacts: ClientContactRow[]
}

export interface VehicleSizeRow { name?: string; cubicCapacity?: number; palletCapacity?: number; weightCapacity?: number; fuelPercent?: number }
export interface ZoneRow { name?: string; zips: string[] }
export interface ZoneGroupRow { name?: string; zones: ZoneRow[] }
export interface FuelSurchargeRow { name?: string; ratePercent?: number; start?: string; clientCode?: string }
export interface ZoneRateRow { name?: string; fromZone?: string; toZone?: string; speedId?: number; vehicleSizeNames: string[]; chargeRate?: number; driverRate?: number; clientCodes: string[] }
export interface DistanceRateRow {
  name?: string; speedId?: number; vehicleSizeNames: string[]; baseCharge?: number; baseChargeDriver?: number
  perDistanceUnit?: number; perDistanceUnitDriver?: number; distanceIncluded?: number; depotIds: number[]; clientCodes: string[]
}
export interface RatesStep { vehicleSizes: VehicleSizeRow[]; zoneGroups: ZoneGroupRow[]; fuelSurcharges: FuelSurchargeRow[]; zoneRates: ZoneRateRow[]; distanceRates: DistanceRateRow[] }

export interface DayWindowRow { dayOfWeek?: number; startTime?: string; endTime?: string; cutoffDay?: number; cutoffTime?: string }
export interface ScheduleRow {
  name?: string; regionId?: number; pickupDepotId?: number; originType?: 'depot' | 'client' | 'direct'
  originRegionId?: number; speedId?: number; dayWindows: DayWindowRow[]; clientCodes: string[]
}

export interface FleetRow { name?: string; depotId?: number }
export interface CourierRow {
  email?: string; firstName?: string; surName?: string; code?: string; mobile?: string; vehicleType?: string
  courierTypeId?: number; fleetName?: string
  /** Write-only: sent on save, never returned. */
  initialPassword?: string
  hasInitialPassword?: boolean
}
export interface CouriersStep { fleets: FleetRow[]; couriers: CourierRow[] }

export interface PartnerRow {
  name?: string; isNetworkPartner: boolean; contactName?: string; contactEmail?: string; primaryContactRoleId?: number
  phone?: string; addressLine1?: string; city?: string; state?: string; postCode?: string
  defaultCourierPayPercent?: number; inviteConfirmed: boolean
}

export interface TrainingMember { userEmail: string; userName?: string; role?: string; xp: number; completedChallenges: string[]; currentStreak: number; lastActive?: string }

export interface Session {
  id: string; tenantCode?: string; currentStep: number; status: string; createdByName?: string
  createdAt: string; updatedAt: string
  steps: Record<StepKey, StepState>
  business: BusinessProfile; team: TeamStep; clients: ClientRow[]; rates: RatesStep
  schedules: ScheduleRow[]; couriers: CouriersStep; partners: PartnerRow[]; training: TrainingMember[]
}

export interface SessionSummary {
  id: string; currentStep: number; companyName?: string; createdByName?: string; status: string
  waitingOnTenant: number; stepsDone: number; createdAt: string; updatedAt: string
}

export interface Me {
  success: boolean; tenantId: string; tenantCode?: string; clientTypeId?: number; isDfAdmin: boolean; isUsTenant: boolean; name?: string
  contactProfile?: { firstName?: string; lastName?: string; email?: string } | null
  clientProfile?: { name?: string } | null
}

export interface PushSummary { created: number; needsData: number; failed: number; signInExpired: boolean }
export interface LookupItem { id: number; name: string }

// ── Calls ────────────────────────────────────────────────────────────────────

export const validateLogin = () => request<Me>('/API/Login/Validate', { method: 'POST' })

export const createSession = () => request<{ session: Session }>('/setup/session', { method: 'POST' })
export const listSessions = (status = 'active') => request<{ sessions: SessionSummary[] }>(`/setup/sessions?status=${encodeURIComponent(status)}`)
export const getSession = (id: string) => request<{ session: Session }>(`/setup/session/${id}`)
export const deleteSession = (id: string) => request<{ success: boolean }>(`/setup/session/${id}`, { method: 'DELETE' })
export const setCurrentStep = (id: string, step: number) => request(`/setup/session/${id}/current-step`, { method: 'POST', body: json({ step }) })

export const saveStepData = (id: string, step: StepKey, data: unknown) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/data`, { method: 'PUT', body: json(data) })
export const pushStep = (id: string, step: StepKey) =>
  request<{ session: Session; summary: PushSummary }>(`/setup/session/${id}/steps/${step}/push`, { method: 'POST' })

export const addRequest = (id: string, step: StepKey, item: string, dueBy?: string) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/requests`, { method: 'POST', body: json({ item, dueBy: dueBy || null }) })
export const fulfilRequest = (id: string, step: StepKey, requestId: string) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/requests/${requestId}/fulfil`, { method: 'POST' })
export const tickChecklist = (id: string, step: StepKey, itemId: string, done: boolean) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/checklist/${itemId}`, { method: 'POST', body: json({ done }) })
export const completeStep = (id: string, step: StepKey) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/complete`, { method: 'POST' })
export const reopenStep = (id: string, step: StepKey) =>
  request<{ session: Session }>(`/setup/session/${id}/steps/${step}/reopen`, { method: 'POST' })

export const getTenantSummary = (id: string) => request<{ settings: Record<string, string>; counts: Record<string, number> }>(`/setup/session/${id}/tenant-summary`)
export const getTenantLogo = () => request<{ success: boolean; logoUrl: string | null }>('/setup/logo')

export const lookup = <T = LookupItem[]>(name: string) => request<T>(`/setup/lookups/${name}`)

export const validate = (what: 'contact-email' | 'client-name' | 'client-code' | 'courier-email' | 'courier-code', value: string) => {
  const param = what.endsWith('email') ? 'email' : what.endsWith('name') ? 'name' : 'code'
  return request<{ available: boolean | null; unchecked?: boolean }>(`/setup/validate/${what}?${param}=${encodeURIComponent(value)}`)
}

export const getTraining = (id: string) => request<{ progress: TrainingMember[] }>(`/setup/session/${id}/training`)
export const saveTraining = (id: string, members: TrainingMember[]) => request(`/setup/session/${id}/training`, { method: 'PUT', body: json(members) })
export const completeChallenge = (id: string, userEmail: string, challengeId: string, xpEarned: number) =>
  request(`/setup/session/${id}/training/complete-challenge`, { method: 'POST', body: json({ userEmail, challengeId, xpEarned }) })
export const getLeaderboard = (id: string) => request<{ leaderboard: unknown[] }>(`/setup/session/${id}/training/leaderboard`)
