let BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

export const createSession = (environment?: string) =>
  post('/setup/session', { environment })

export const saveBusinessProfile = (sessionId: string, data: Record<string, unknown>) =>
  post('/setup/business', { sessionId, ...data })

export const saveTeam = (sessionId: string, members: unknown[]) =>
  post('/setup/team', { sessionId, members })

export const saveClients = (sessionId: string, clients: unknown[]) =>
  post('/setup/clients', { sessionId, clients })

export const uploadClientsCsv = async (sessionId: string, file: File) => {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('file', file)
  const res = await fetch(`${BASE_URL}/setup/clients/import`, { method: 'POST', body: form, credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

export const saveRates = (sessionId: string, rateData: Record<string, unknown>) =>
  post('/setup/rates', { sessionId, ...rateData })

export const saveCouriers = (sessionId: string, couriers: unknown[]) =>
  post('/setup/couriers', { sessionId, couriers })

export const saveAutomations = (sessionId: string, rules: unknown[]) =>
  post('/setup/automations', { sessionId, rules })

// Session management
async function get(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

async function del(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

export const listSessions = (status = 'active') =>
  get(`/setup/sessions?status=${status}`)

export const getFullSession = (id: string) =>
  get(`/setup/session/${id}/full`)

export const rollbackSession = (id: string) =>
  del(`/setup/session/${id}/rollback`)

// Training
export const getTrainingProgress = (sessionId: string) =>
  get(`/setup/training/progress?sessionId=${sessionId}`)

export const saveTrainingProgress = (sessionId: string, members: unknown[]) =>
  post('/setup/training/progress', { sessionId, members })

export const completeTrainingChallenge = (sessionId: string, userEmail: string, challengeId: string, xpEarned: number) =>
  post('/setup/training/complete-challenge', { sessionId, userEmail, challengeId, xpEarned })

export const getLeaderboard = (sessionId: string) =>
  get(`/setup/training/leaderboard?sessionId=${sessionId}`)

// Validation
export const validateUserFullName = (name: string) =>
  get(`/setup/validate/user-fullname?name=${encodeURIComponent(name)}`)

export const validateClientName = (name: string) =>
  get(`/setup/validate/client-name?name=${encodeURIComponent(name)}`)

export const validateCourierName = (firstName: string, surname: string) =>
  get(`/setup/validate/courier-name?firstName=${encodeURIComponent(firstName)}&surname=${encodeURIComponent(surname)}`)

export const validateUsername = (username: string) =>
  get(`/setup/validate/username?username=${encodeURIComponent(username)}`)

export const validateClientCode = (code: string) =>
  get(`/setup/validate/client-code?code=${encodeURIComponent(code)}`)

export const validateCourierCode = (code: string) =>
  get(`/setup/validate/courier-code?code=${encodeURIComponent(code)}`)

// Tenant data (Phase 1: populate wizard from real DB)
export const getTenantData = (sessionId: string) =>
  get(`/setup/session/${sessionId}/tenant-data`)

// Lazy-load: fast summary (counts + settings only)
export const getTenantSummary = (sessionId: string) =>
  get(`/setup/session/${sessionId}/tenant-summary`)

// Go Live (Phase 5: provision all wizard data)
// Uses raw fetch instead of post() to preserve partial provisioning data on failure
export async function goLive(sessionId: string) {
  const res = await fetch(`${BASE_URL}/setup/session/${sessionId}/go-live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const data = await res.json().catch(() => ({ success: false, errors: [res.statusText] }))
  return data
}

// Tenant logo (direct S3 pre-signed URL)
// Bucket: urgent-couriers-bulk-upload-storage-{environment}
export const getTenantLogo = (environment: string, tenantCode?: string) =>
  get(`/setup/logo?environment=${encodeURIComponent(environment)}${tenantCode ? `&tenantCode=${encodeURIComponent(tenantCode)}` : ''}`)

// Authentication — validates Hub cookie and caches connection string in Redis
// Same pattern as AdminManager: auto-call on page load
export async function validateLogin(): Promise<{
  success: boolean
  tenantId?: string
  staffId?: string
  contactId?: string
  tenantCode?: string
  envKey?: string
  clientProfile?: { id?: number; name?: string; legalName?: string; code?: string; address?: string; postCode?: string; phone?: string; email?: string; type?: string; city?: string; state?: string }
  contactProfile?: { id?: number; firstName?: string; lastName?: string; email?: string; phone?: string; title?: string }
  message?: string
}> {
  const res = await fetch(`/API/Login/Validate`, { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Authentication failed')
  }
  return res.json()
}

// Environments
export const getEnvironments = () =>
  get('/setup/environments')

export function setApiBaseUrl(url: string) {
  BASE_URL = url
}

export function getApiBaseUrl() {
  return BASE_URL
}
