import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as api from './lib/api'

export interface TeamMember {
  name: string
  email: string
  role: string
}

export interface Client {
  name: string
  contact: string
  phone: string
  email: string
  billing: string
}

export interface ClientContact {
  clientName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
}

export interface ChatMessage {
  from: 'bot' | 'user'
  text: string
}

export interface SavedSession {
  id: string
  environment: string
  currentStep: number
  completedSteps: number[]
  businessData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface UploadedDocument {
  name: string
  size: number
  type: string
}

interface SetupState {
  currentStep: number
  completedSteps: Set<number>

  // Step 0: Business
  companyName: string
  geography: string
  selectedCities: string[]
  selectedVerticals: string[]
  currentSystem: string
  deliveryVolume: string

  // Step 1: Team
  teamMembers: TeamMember[]

  // Step 2: Clients
  clients: Client[]
  clientContacts: ClientContact[]

  // Step 3: Rates
  rates: Record<string, string>
  zonePricing: string[][]
  weightBreaks: string[]

  // Step 4: Couriers
  couriers: { name: string; phone: string; vehicle: string; zone: string }[]

  // Step 5: Automations
  automations: Record<string, boolean>

  // Step 6: Integrations
  integrationPrompt: string

  // Step 7: App Config
  appFeatures: Record<string, boolean>
  selectedProfiles: string[]

  // Step 8: Partners
  useOverflow: boolean
  joinNetwork: boolean

  // Step 0 expanded
  legalName: string
  registrationNumber: string
  countryOfRegistration: string
  stateOfIncorporation: string
  businessType: string
  uploadedDocuments: UploadedDocument[]
  cardNumber: string
  cardExpiry: string
  cardCvc: string
  cardholderName: string
  billingAddress: { street: string; city: string; state: string; zip: string }
  primaryContact: { name: string; email: string; phone: string; title: string }

  // Environment
  selectedEnvironment: string
  tenantCode: string

  // Step 9: Training
  trainingProgress: Record<string, {
    xp: number
    completedChallenges: string[]
    currentStreak: number
    lastActive: string
    role: string
  }>

  // Tenant logo
  tenantLogoUrl: string | null

  // API
  sessionId: string | null
  apiStatus: Record<number, 'idle' | 'saving' | 'saved' | 'error'>
  apiErrors: Record<number, string>
  stepValidationBlocked: Record<number, boolean>

  // Resume
  availableSessions: SavedSession[]
  showResumePrompt: boolean

  // Help Panel
  helpPanelOpen: boolean

  // Chat
  chatHistory: ChatMessage[]
  shownChatSteps: Set<number>

  // Actions
  setCurrentStep: (step: number) => void
  completeStep: (step: number) => void
  setCompanyName: (name: string) => void
  setGeography: (geo: string) => void
  toggleCity: (city: string) => void
  toggleVertical: (v: string) => void
  setCurrentSystem: (s: string) => void
  setDeliveryVolume: (v: string) => void
  setTeamMembers: (members: TeamMember[]) => void
  addTeamMember: () => void
  updateTeamMember: (index: number, field: keyof TeamMember, value: string) => void
  setClients: (clients: Client[]) => void
  addClient: (client: Client) => void
  updateClient: (index: number, field: keyof Client, value: string) => void
  setClientContacts: (contacts: ClientContact[]) => void
  addClientContact: () => void
  updateClientContact: (index: number, field: keyof ClientContact, value: string | boolean) => void
  setCouriers: (couriers: { name: string; phone: string; vehicle: string; zone: string }[]) => void
  addCourier: () => void
  updateCourier: (index: number, field: 'name' | 'phone' | 'vehicle' | 'zone', value: string) => void
  setRate: (key: string, value: string) => void
  setZonePrice: (row: number, col: number, value: string) => void
  setWeightBreak: (index: number, value: string) => void
  toggleAutomation: (key: string) => void
  setIntegrationPrompt: (p: string) => void
  toggleAppFeature: (key: string) => void
  toggleProfile: (p: string) => void
  setUseOverflow: (v: boolean) => void
  setJoinNetwork: (v: boolean) => void
  setSelectedEnvironment: (env: string) => void
  initTraining: () => void
  completeChallenge: (email: string, challengeId: string) => void
  setSessionId: (id: string | null) => void
  setApiStatus: (step: number, status: 'idle' | 'saving' | 'saved' | 'error') => void
  setApiError: (step: number, error: string) => void
  clearApiError: (step: number) => void
  setStepValidationBlocked: (step: number, blocked: boolean) => void
  initSession: () => Promise<void>
  saveStep: (step: number) => Promise<void>
  // Step 0 expanded setters
  setLegalName: (v: string) => void
  setRegistrationNumber: (v: string) => void
  setCountryOfRegistration: (v: string) => void
  setStateOfIncorporation: (v: string) => void
  setBusinessType: (v: string) => void
  addUploadedDocument: (doc: UploadedDocument) => void
  removeUploadedDocument: (name: string) => void
  setCardNumber: (v: string) => void
  setCardExpiry: (v: string) => void
  setCardCvc: (v: string) => void
  setCardholderName: (v: string) => void
  setBillingAddress: (field: string, value: string) => void
  setPrimaryContact: (field: string, value: string) => void

  // Load tenant data from DB
  loadTenantData: (sessionId: string) => Promise<void>
  tenantDataLoaded: boolean
  tenantCounts: { team: number; clients: number; contacts: number; couriers: number; zones: number; automations: number; services: number } | null

  // Go Live
  goLive: () => Promise<void>
  goLiveStatus: 'idle' | 'running' | 'success' | 'error'
  goLiveResult: { provisioned: Record<string, number>; errors: string[] } | null

  // Resume / rollback
  checkForSessions: () => Promise<void>
  resumeSession: (sessionData: any) => void
  dismissResumePrompt: () => void

  isInitializing: boolean
  toggleHelpPanel: () => void
  addChatMessage: (msg: ChatMessage) => void
  markChatStepShown: (step: number) => void
  getCompletionPercentage: () => number
}

export const useStore = create<SetupState>()(persist((set, get) => ({
  currentStep: 0,
  completedSteps: new Set(),

  companyName: '',
  geography: '',
  selectedCities: [],
  selectedVerticals: [],
  currentSystem: 'None',
  deliveryVolume: '< 500',

  teamMembers: [],

  clients: [],
  clientContacts: [],

  rates: {},
  zonePricing: [],
  weightBreaks: [],

  couriers: [],

  automations: {},

  integrationPrompt: '',

  appFeatures: {},
  selectedProfiles: [],

  useOverflow: false,
  joinNetwork: true,

  legalName: '',
  registrationNumber: '',
  countryOfRegistration: '',
  stateOfIncorporation: '',
  businessType: '',
  uploadedDocuments: [],
  cardNumber: '',
  cardExpiry: '',
  cardCvc: '',
  cardholderName: '',
  billingAddress: { street: '', city: '', state: '', zip: '' },
  primaryContact: { name: '', email: '', phone: '', title: '' },

  selectedEnvironment: 'medical-staging',
  tenantCode: '',
  trainingProgress: {},

  helpPanelOpen: false,

  availableSessions: [],
  showResumePrompt: false,

  isInitializing: false,
  tenantDataLoaded: false,
  tenantCounts: null,
  tenantLogoUrl: null,
  goLiveStatus: 'idle',
  goLiveResult: null,

  sessionId: null,
  apiStatus: {},
  apiErrors: {},
  stepValidationBlocked: {},

  chatHistory: [],
  shownChatSteps: new Set(),

  setCurrentStep: (step) => set({ currentStep: step }),
  completeStep: (step) => set((s) => {
    const next = new Set(s.completedSteps)
    next.add(step)
    return { completedSteps: next }
  }),

  setCompanyName: (name) => set({ companyName: name }),
  setGeography: (geo) => set({ geography: geo }),
  toggleCity: (city) => set((s) => {
    const c = [...s.selectedCities]
    const i = c.indexOf(city)
    if (i >= 0) c.splice(i, 1)
    else c.push(city)
    return { selectedCities: c }
  }),
  toggleVertical: (v) => set((s) => {
    const vs = [...s.selectedVerticals]
    const i = vs.indexOf(v)
    if (i >= 0) vs.splice(i, 1)
    else vs.push(v)
    return { selectedVerticals: vs }
  }),
  setCurrentSystem: (s) => set({ currentSystem: s }),
  setDeliveryVolume: (v) => set({ deliveryVolume: v }),

  setTeamMembers: (members) => set({ teamMembers: members }),
  addTeamMember: () => set((s) => ({
    teamMembers: [...s.teamMembers, { name: '', email: '', role: 'Admin' }]
  })),
  updateTeamMember: (index, field, value) => set((s) => {
    const m = [...s.teamMembers]
    m[index] = { ...m[index], [field]: value }
    return { teamMembers: m }
  }),

  setClients: (clients) => set({ clients }),
  addClient: (client) => set((s) => ({ clients: [...s.clients, client] })),
  updateClient: (index, field, value) => set((s) => {
    const c = [...s.clients]
    c[index] = { ...c[index], [field]: value }
    return { clients: c }
  }),
  setClientContacts: (clientContacts) => set({ clientContacts }),
  addClientContact: () => set((s) => ({
    clientContacts: [...s.clientContacts, { clientName: '', firstName: '', lastName: '', email: '', phone: '', role: '', isPrimary: false }]
  })),
  updateClientContact: (index, field, value) => set((s) => {
    const c = [...s.clientContacts]
    c[index] = { ...c[index], [field]: value }
    return { clientContacts: c }
  }),
  setCouriers: (couriers) => set({ couriers }),
  addCourier: () => set((s) => ({
    couriers: [...s.couriers, { name: '', phone: '', vehicle: 'Car', zone: '' }]
  })),
  updateCourier: (index, field, value) => set((s) => {
    const c = [...s.couriers]
    c[index] = { ...c[index], [field]: value }
    return { couriers: c }
  }),

  setRate: (key, value) => set((s) => ({ rates: { ...s.rates, [key]: value } })),
  setZonePrice: (row, col, value) => set((s) => {
    const zp = s.zonePricing.map(r => [...r])
    zp[row][col] = value
    return { zonePricing: zp }
  }),
  setWeightBreak: (index, value) => set((s) => {
    const wb = [...s.weightBreaks]
    wb[index] = value
    return { weightBreaks: wb }
  }),

  toggleAutomation: (key) => set((s) => ({
    automations: { ...s.automations, [key]: !s.automations[key] }
  })),

  setIntegrationPrompt: (p) => set({ integrationPrompt: p }),

  toggleAppFeature: (key) => set((s) => ({
    appFeatures: { ...s.appFeatures, [key]: !s.appFeatures[key] }
  })),
  toggleProfile: (p) => set((s) => {
    const ps = [...s.selectedProfiles]
    const i = ps.indexOf(p)
    if (i >= 0) ps.splice(i, 1)
    else ps.push(p)
    return { selectedProfiles: ps }
  }),

  setUseOverflow: (v) => set({ useOverflow: v }),
  setJoinNetwork: (v) => set({ joinNetwork: v }),

  setSelectedEnvironment: (env) => set({ selectedEnvironment: env }),

  initTraining: () => {
    const s = get()
    // Try loading from backend first
    if (s.sessionId) {
      api.getTrainingProgress(s.sessionId).then(res => {
        if (res.progress && res.progress.length > 0) {
          const progress: Record<string, any> = {}
          for (const p of res.progress) {
            progress[p.userEmail] = {
              xp: p.xp, completedChallenges: p.completedChallenges,
              currentStreak: p.currentStreak, lastActive: p.lastActive, role: p.role,
            }
          }
          set({ trainingProgress: progress })
          return
        }
        // No backend data — init with defaults and save
        initDefaultTraining(s)
      }).catch(() => {
        // Offline — init with defaults
        initDefaultTraining(s)
      })
    } else {
      initDefaultTraining(s)
    }

    function initDefaultTraining(s: any) {
      const progress: Record<string, { xp: number; completedChallenges: string[]; currentStreak: number; lastActive: string; role: string }> = {}
      s.teamMembers.forEach((m: TeamMember) => {
        progress[m.email] = {
          xp: 0, completedChallenges: [], currentStreak: 0, lastActive: new Date().toISOString(), role: m.role,
        }
      })
      set({ trainingProgress: progress })
      // Persist to backend
      if (s.sessionId) {
        const members = Object.entries(progress).map(([email, data]) => ({
          userEmail: email, userName: s.teamMembers.find((m: TeamMember) => m.email === email)?.name || email,
          role: data.role, xp: data.xp, completedChallenges: data.completedChallenges,
          currentStreak: data.currentStreak, lastActive: data.lastActive,
        }))
        api.saveTrainingProgress(s.sessionId, members).catch(() => {})
      }
    }
  },

  completeChallenge: (email, challengeId) => {
    const s = get()
    const tp = { ...s.trainingProgress }
    const member = tp[email]
    if (!member || member.completedChallenges.includes(challengeId)) return
    const allChallenges = Object.values({
      dispatcher: [{ id: 'first-job', xp: 50 }, { id: 'speed-10', xp: 100 }, { id: 'auto-shadow', xp: 150 }, { id: 'auto-suggest', xp: 200 }, { id: 'multi-stop', xp: 125 }, { id: 'reassign', xp: 75 }, { id: 'zero-touch', xp: 200 }, { id: 'dispatch-master', xp: 500 }],
      admin: [{ id: 'add-client', xp: 50 }, { id: 'rate-card', xp: 100 }, { id: 'zone-setup', xp: 100 }, { id: 'automation-rule', xp: 125 }, { id: 'kb-article', xp: 75 }, { id: 'import-clients', xp: 150 }, { id: 'reporting', xp: 125 }, { id: 'admin-master', xp: 500 }],
      accounts: [{ id: 'first-invoice', xp: 50 }, { id: 'batch-invoice', xp: 125 }, { id: 'xero-sync', xp: 100 }, { id: 'statement', xp: 75 }, { id: 'rate-review', xp: 150 }, { id: 'accounts-master', xp: 500 }],
      driver: [{ id: 'app-install', xp: 25 }, { id: 'first-delivery', xp: 50 }, { id: 'pod-pro', xp: 75 }, { id: 'barcode', xp: 75 }, { id: 'nav-ace', xp: 50 }, { id: 'streak-3', xp: 100 }, { id: 'driver-master', xp: 500 }],
    }).flat()
    const xpReward = allChallenges.find(c => c.id === challengeId)?.xp || 0
    tp[email] = {
      ...member,
      xp: member.xp + xpReward,
      completedChallenges: [...member.completedChallenges, challengeId],
      lastActive: new Date().toISOString(),
    }
    set({ trainingProgress: tp })
    // Persist to backend
    if (s.sessionId) {
      api.completeTrainingChallenge(s.sessionId, email, challengeId, xpReward).catch(() => {})
    }
  },

  setSessionId: (id) => set({ sessionId: id }),
  setApiStatus: (step, status) => set((s) => ({ apiStatus: { ...s.apiStatus, [step]: status } })),
  setApiError: (step, error) => set((s) => ({ apiErrors: { ...s.apiErrors, [step]: error } })),
  clearApiError: (step) => set((s) => { const e = { ...s.apiErrors }; delete e[step]; return { apiErrors: e } }),
  setStepValidationBlocked: (step: number, blocked: boolean) => set((s) => ({ stepValidationBlocked: { ...s.stepValidationBlocked, [step]: blocked } })),

  initSession: async () => {
    set({ isInitializing: true })
    try {
      // Validate Hub cookie and cache connection string in Redis (AdminManager pattern)
      // Also returns the logged-in user's client profile via StaffId → ClientContact → Client
      const loginResult = await api.validateLogin()

      // Pre-populate Step 0 business profile from the logged-in user's company (TucClient)
      if (loginResult.clientProfile) {
        const cp = loginResult.clientProfile
        const updates: Partial<SetupState> = {}
        if (cp.name) updates.companyName = cp.name
        if (cp.legalName) updates.legalName = cp.legalName
        if (cp.address) updates.billingAddress = { ...get().billingAddress, street: cp.address }
        if (cp.city) updates.billingAddress = { ...(updates.billingAddress || get().billingAddress), city: cp.city }
        if (cp.state) updates.billingAddress = { ...(updates.billingAddress || get().billingAddress), state: cp.state }
        if (cp.postCode) updates.billingAddress = { ...(updates.billingAddress || get().billingAddress), zip: cp.postCode }
        set(updates as any)
      }
      if (loginResult.contactProfile) {
        const ct = loginResult.contactProfile
        const updates: Partial<SetupState> = {}
        const fullName = [ct.firstName, ct.lastName].filter(Boolean).join(' ')
        if (fullName) updates.primaryContact = { ...get().primaryContact, name: fullName }
        if (ct.email) updates.primaryContact = { ...(updates.primaryContact || get().primaryContact), email: ct.email }
        if (ct.phone) updates.primaryContact = { ...(updates.primaryContact || get().primaryContact), phone: ct.phone }
        if (ct.title) updates.primaryContact = { ...(updates.primaryContact || get().primaryContact), title: ct.title }
        set(updates as any)
      }
      // Set environment and tenant code from login response
      if (loginResult.envKey) {
        set({ selectedEnvironment: loginResult.envKey })
      }
      if (loginResult.tenantCode) {
        set({ tenantCode: loginResult.tenantCode })
      }
    } catch (e) {
      console.warn('Login validation failed:', e)
    }
    // Skip session creation if we already have one from sessionStorage
    const existingSessionId = get().sessionId
    if (existingSessionId) {
      console.log('Resuming session from storage:', existingSessionId)
      if (!get().tenantDataLoaded) {
        await get().loadTenantData(existingSessionId).catch(() => {})
      }
    } else {
      try {
        const res = await api.createSession(get().selectedEnvironment)
        const sessionId = res.session?.id || res.id || null
        set({ sessionId })
        if (sessionId) {
          await get().loadTenantData(sessionId)
        }
      } catch (e) {
        console.warn('Could not create session, running offline:', e)
      }
    }
    set({ isInitializing: false })
    // Fetch tenant logo (non-blocking)
    api.getTenantLogo(get().selectedEnvironment, get().tenantCode).then(res => {
      if (res.success && res.logoUrl) set({ tenantLogoUrl: res.logoUrl })
    }).catch(() => {})
  },

  saveStep: async (step) => {
    const s = get()
    if (!s.sessionId) { console.warn('No session, skipping save'); return }
    set((st) => ({ apiStatus: { ...st.apiStatus, [step]: 'saving' as const }, apiErrors: { ...st.apiErrors } }))
    try {
      switch (step) {
        case 0:
          await api.saveBusinessProfile(s.sessionId, {
            companyName: s.companyName,
            geography: s.selectedCities,
            verticals: s.selectedVerticals,
            currentSystem: s.currentSystem,
            deliveriesPerMonth: s.deliveryVolume,
            legalName: s.legalName || undefined,
            registrationNumber: s.registrationNumber || undefined,
            countryOfRegistration: s.countryOfRegistration || undefined,
            stateOfIncorporation: s.stateOfIncorporation || undefined,
            businessType: s.businessType || undefined,
            cardNumber: s.cardNumber || undefined,
            cardExpiry: s.cardExpiry || undefined,
            cardCvc: s.cardCvc || undefined,
            cardholderName: s.cardholderName || undefined,
            billingAddress: s.billingAddress.street ? s.billingAddress : undefined,
            primaryContact: s.primaryContact.name ? s.primaryContact : undefined,
          }); break
        case 1:
          await api.saveTeam(s.sessionId, s.teamMembers); break
        case 2:
          await api.saveClients(s.sessionId, s.clients.map(c => ({
            name: c.name, contact: c.contact, phone: c.phone, email: c.email, billing: c.billing,
          }))); break
        case 3:
          await api.saveRates(s.sessionId, {
            baseRate: parseFloat(s.rates['Base Rate']?.replace('$', '') || '0'),
            perKmRate: parseFloat(s.rates['Per KM Rate']?.replace('$', '') || '0'),
            minCharge: parseFloat(s.rates['Minimum Charge']?.replace('$', '') || '0'),
            fuelSurcharge: parseFloat(s.rates['Fuel Surcharge']?.replace('%', '') || '0'),
            waitTime: parseFloat(s.rates['Wait Time']?.replace('$', '') || '0'),
            afterHours: parseFloat(s.rates['After Hours']?.replace('%', '') || '0'),
            zones: s.zonePricing.map(row => ({ name: row[0], ranges: row.slice(1) })),
            weightBreaks: [
              { min: 0, max: 5, surcharge: 0 }, { min: 5, max: 15, surcharge: 2 },
              { min: 15, max: 30, surcharge: 5 }, { min: 30, max: 50, surcharge: 10 },
              { min: 50, max: 999, surcharge: 0 },
            ],
          }); break
        case 4:
          await api.saveCouriers(s.sessionId, s.couriers.map(c => ({
            name: c.name, phone: c.phone, vehicle: c.vehicle.replace(/^[^ ]+ /, ''), zone: c.zone,
          }))); break
        case 5:
          await api.saveAutomations(s.sessionId, Object.entries(s.automations).map(([key, enabled]) => ({
            type: key.replace(/ /g, '_').toUpperCase(), enabled, name: key,
          }))); break
        default: return
      }
      set((st) => ({ apiStatus: { ...st.apiStatus, [step]: 'saved' as const } }))
      // Clear error if any
      set((st) => { const e = { ...st.apiErrors }; delete e[step]; return { apiErrors: e } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      console.warn(`Step ${step} save failed:`, msg)
      set((st) => ({ apiStatus: { ...st.apiStatus, [step]: 'error' as const }, apiErrors: { ...st.apiErrors, [step]: msg } }))
    }
  },

  setLegalName: (v) => set({ legalName: v }),
  setRegistrationNumber: (v) => set({ registrationNumber: v }),
  setCountryOfRegistration: (v) => set({ countryOfRegistration: v }),
  setStateOfIncorporation: (v) => set({ stateOfIncorporation: v }),
  setBusinessType: (v) => set({ businessType: v }),
  addUploadedDocument: (doc) => set((s) => ({ uploadedDocuments: [...s.uploadedDocuments, doc] })),
  removeUploadedDocument: (name) => set((s) => ({ uploadedDocuments: s.uploadedDocuments.filter(d => d.name !== name) })),
  setCardNumber: (v) => set({ cardNumber: v }),
  setCardExpiry: (v) => set({ cardExpiry: v }),
  setCardCvc: (v) => set({ cardCvc: v }),
  setCardholderName: (v) => set({ cardholderName: v }),
  setBillingAddress: (field, value) => set((s) => ({ billingAddress: { ...s.billingAddress, [field]: value } })),
  setPrimaryContact: (field, value) => set((s) => ({ primaryContact: { ...s.primaryContact, [field]: value } })),

  loadTenantData: async (sessionId: string) => {
    try {
      // Fast path: only load summary (counts + settings), ~50ms
      const data = await api.getTenantSummary(sessionId)

      const updates: Partial<SetupState> = { tenantDataLoaded: true }

      // Note: data.settings contains SystemName (software name, e.g. "Despatch Manager"),
      // not the company name. Company info comes from the validateLogin clientProfile instead.

      // Store counts for UI badges
      if (data.counts) {
        updates.tenantCounts = data.counts
      }

      set(updates as any)
    } catch (e) {
      console.warn('Could not load tenant data:', e)
      set({ tenantDataLoaded: true })
    }
  },

  goLive: async () => {
    const s = get()
    if (!s.sessionId) return
    set({ goLiveStatus: 'running' as const, goLiveResult: null })
    try {
      const result = await api.goLive(s.sessionId)
      set({
        goLiveStatus: result.success ? 'success' as const : 'error' as const,
        goLiveResult: { provisioned: result.provisioned || {}, errors: result.errors || [] },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Go Live failed'
      set({
        goLiveStatus: 'error' as const,
        goLiveResult: { provisioned: {}, errors: [msg] },
      })
    }
  },

  checkForSessions: async () => {
    try {
      const res = await api.listSessions()
      const sessions = res.sessions || []
      if (sessions.length > 0) {
        set({ availableSessions: sessions, showResumePrompt: true })
      }
    } catch (e) {
      console.warn('Could not check for sessions:', e)
    }
  },

  resumeSession: async (data: any) => {
    const session = data.session
    const biz = session.business || session.businessData || {}
    // Use the furthest step between backend and local state
    const localStep = get().currentStep
    const backendStep = session.currentStep || 0
    const localCompleted = get().completedSteps
    const backendCompleted = new Set<number>(session.completedSteps || [])
    set({
      sessionId: session.id,
      currentStep: Math.max(localStep, backendStep),
      completedSteps: localCompleted.size >= backendCompleted.size ? localCompleted : backendCompleted,
      companyName: biz.companyName || '',
      geography: biz.geography?.[0] || '',
      selectedCities: biz.geography || [],
      selectedVerticals: biz.verticals || [],
      currentSystem: biz.currentSystem || 'None',
      deliveryVolume: biz.deliveriesPerMonth || '< 500',
      legalName: biz.legalName || '',
      registrationNumber: biz.registrationNumber || '',
      countryOfRegistration: biz.countryOfRegistration || '',
      stateOfIncorporation: biz.stateOfIncorporation || '',
      businessType: biz.businessType || '',
      cardNumber: biz.cardNumber || '',
      cardExpiry: biz.cardExpiry || '',
      cardCvc: biz.cardCvc || '',
      cardholderName: biz.cardholderName || '',
      billingAddress: biz.billingAddress || { street: '', city: '', state: '', zip: '' },
      primaryContact: biz.primaryContact || { name: '', email: '', phone: '', title: '' },
      showResumePrompt: false,
      availableSessions: [],
    })
    // Validate Hub cookie first (caches connection string in Redis), then load tenant data
    if (session.id) {
      try {
        const loginResult = await api.validateLogin()
        // Pre-populate business profile from TucClient (if not already set from resumed session)
        // Update environment from login (derived from Domain + TenantCode)
        if (loginResult.envKey) {
          set({ selectedEnvironment: loginResult.envKey })
        }
        if (loginResult.clientProfile && !biz.companyName) {
          const cp = loginResult.clientProfile
          if (cp.name) set({ companyName: cp.name })
          if (cp.legalName) set({ legalName: cp.legalName })
        }
        if (loginResult.contactProfile && !biz.primaryContact?.name) {
          const ct = loginResult.contactProfile
          const fullName = [ct.firstName, ct.lastName].filter(Boolean).join(' ')
          set({ primaryContact: { name: fullName || '', email: ct.email || '', phone: ct.phone || '', title: ct.title || '' } })
        }
      } catch (e) {
        console.warn('Login validation failed on resume:', e)
      }
      await get().loadTenantData(session.id)
      // Fetch tenant logo from S3 (non-blocking)
      api.getTenantLogo(session.environment || get().selectedEnvironment, get().tenantCode).then(res => {
        if (res.success && res.logoUrl) set({ tenantLogoUrl: res.logoUrl })
      }).catch(() => {})
    }
  },

  dismissResumePrompt: () => set({ showResumePrompt: false }),

  toggleHelpPanel: () => set((s) => ({ helpPanelOpen: !s.helpPanelOpen })),

  addChatMessage: (msg) => set((s) => ({
    chatHistory: [...s.chatHistory, msg]
  })),
  markChatStepShown: (step) => set((s) => {
    const next = new Set(s.shownChatSteps)
    next.add(step)
    return { shownChatSteps: next }
  }),

  getCompletionPercentage: () => {
    const s = get()
    let filled = 0
    let total = 0

    // Step 0
    total += 4
    if (s.companyName) filled++
    if (s.geography) filled++
    if (s.selectedCities.length > 0) filled++
    if (s.selectedVerticals.length > 0) filled++

    // Step 1
    total += 1
    if (s.teamMembers.some(m => m.name && m.email)) filled++

    // Step 2
    total += 1
    if (s.clients.length > 0) filled++

    // Step 3
    total += 1
    if (Object.values(s.rates).some(v => v)) filled++

    // Step 4
    total += 1
    if (s.couriers.length > 0) filled++

    // Step 5
    total += 1
    if (Object.values(s.automations).some(v => v)) filled++

    // Step 6 - optional
    total += 1
    if (s.integrationPrompt) filled++
    else filled += 0.5 // partial credit - it's optional

    // Step 7
    total += 1
    if (Object.values(s.appFeatures).some(v => v)) filled++

    // Step 8
    total += 1
    filled += 0.5 // always partial
    if (s.joinNetwork || s.useOverflow) filled += 0.5

    return Math.round((filled / total) * 100)
  },
}), {
  name: 'setup-dashboard-session',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    // Persist wizard data — not transient UI state
    currentStep: state.currentStep,
    completedSteps: Array.from(state.completedSteps),
    sessionId: state.sessionId,
    selectedEnvironment: state.selectedEnvironment,
    tenantCode: state.tenantCode,
    // Step 0
    companyName: state.companyName,
    geography: state.geography,
    selectedCities: state.selectedCities,
    selectedVerticals: state.selectedVerticals,
    currentSystem: state.currentSystem,
    deliveryVolume: state.deliveryVolume,
    legalName: state.legalName,
    registrationNumber: state.registrationNumber,
    countryOfRegistration: state.countryOfRegistration,
    stateOfIncorporation: state.stateOfIncorporation,
    businessType: state.businessType,
    primaryContact: state.primaryContact,
    billingAddress: state.billingAddress,
    cardholderName: state.cardholderName,
    // Step 1
    teamMembers: state.teamMembers,
    // Step 2
    clients: state.clients,
    clientContacts: state.clientContacts,
    // Step 3
    rates: state.rates,
    zonePricing: state.zonePricing,
    weightBreaks: state.weightBreaks,
    // Step 4
    couriers: state.couriers,
    // Step 5
    automations: state.automations,
    // Steps 6-8
    integrationPrompt: state.integrationPrompt,
    appFeatures: state.appFeatures,
    selectedProfiles: state.selectedProfiles,
    useOverflow: state.useOverflow,
    joinNetwork: state.joinNetwork,
    // Step 9
    trainingProgress: state.trainingProgress,
    // Tenant data
    tenantDataLoaded: state.tenantDataLoaded,
    tenantCounts: state.tenantCounts,
    tenantLogoUrl: state.tenantLogoUrl,
  }),
  onRehydrateStorage: () => (state) => {
    // Convert completedSteps array back to Set after rehydration
    if (state && Array.isArray(state.completedSteps)) {
      state.completedSteps = new Set(state.completedSteps as unknown as number[])
    }
  },
}))
