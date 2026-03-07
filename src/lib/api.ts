let BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${BASE_URL}/setup/clients/import`, { method: 'POST', body: form })
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
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

async function del(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
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
export const validateUsername = (username: string) =>
  get(`/setup/validate/username?username=${encodeURIComponent(username)}`)

export const validateClientCode = (code: string) =>
  get(`/setup/validate/client-code?code=${encodeURIComponent(code)}`)

export const validateCourierCode = (code: string) =>
  get(`/setup/validate/courier-code?code=${encodeURIComponent(code)}`)

// Environments
export const getEnvironments = () =>
  get('/setup/environments')

export function setApiBaseUrl(url: string) {
  BASE_URL = url
}

export function getApiBaseUrl() {
  return BASE_URL
}
