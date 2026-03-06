import { create } from 'zustand'

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

export interface ChatMessage {
  from: 'bot' | 'user'
  text: string
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
  setRate: (key: string, value: string) => void
  setZonePrice: (row: number, col: number, value: string) => void
  setWeightBreak: (index: number, value: string) => void
  toggleAutomation: (key: string) => void
  setIntegrationPrompt: (p: string) => void
  toggleAppFeature: (key: string) => void
  toggleProfile: (p: string) => void
  setUseOverflow: (v: boolean) => void
  setJoinNetwork: (v: boolean) => void
  addChatMessage: (msg: ChatMessage) => void
  markChatStepShown: (step: number) => void
  getCompletionPercentage: () => number
}

export const useStore = create<SetupState>((set, get) => ({
  currentStep: 0,
  completedSteps: new Set(),

  companyName: '',
  geography: '',
  selectedCities: ['Dallas–Fort Worth', 'Houston', 'Austin', 'San Antonio'],
  selectedVerticals: ['Medical', 'Legal'],
  currentSystem: 'None',
  deliveryVolume: '< 500',

  teamMembers: [
    { name: 'Sarah Chen', email: 'sarah@swiftlogistics.com', role: 'Admin' },
    { name: 'Mike Torres', email: 'mike@swiftlogistics.com', role: 'Dispatcher' },
  ],

  clients: [
    { name: 'Acme Medical', contact: 'Lisa Park', phone: '(214) 555-0101', email: 'lisa@acme.med', billing: 'Monthly' },
    { name: 'DFW Legal Docs', contact: 'Tom Harris', phone: '(469) 555-0202', email: 'tom@dfwlegal.com', billing: 'Per Delivery' },
    { name: 'Fresh Eats Co', contact: 'Ana Rivera', phone: '(972) 555-0303', email: 'ana@fresheats.co', billing: 'Weekly' },
    { name: 'SecureShip Inc', contact: 'David Chen', phone: '(817) 555-0404', email: 'david@secureship.com', billing: 'Monthly' },
  ],

  rates: {
    'Base Rate': '$8.50',
    'Per KM Rate': '$1.85',
    'Minimum Charge': '$12.00',
    'Fuel Surcharge': '8.5%',
    'Wait Time': '$0.50',
    'After Hours': '25%',
  },
  zonePricing: [
    ['Downtown', '$8.50', '$12.00', '$18.00', '$25.00'],
    ['Suburban', '$10.00', '$14.50', '$20.00', '$28.00'],
    ['Metro Wide', '$12.00', '$16.00', '$22.00', '$32.00'],
  ],
  weightBreaks: ['$0.00', '+$2.00', '+$5.00', '+$10.00', 'Quote'],

  couriers: [
    { name: 'James Wilson', phone: '(214) 555-1001', vehicle: '🚐 Van', zone: 'Downtown' },
    { name: 'Maria Garcia', phone: '(469) 555-1002', vehicle: '🚗 Car', zone: 'Suburban' },
    { name: 'Tyler Brooks', phone: '(972) 555-1003', vehicle: '🏍️ Bike', zone: 'Downtown' },
    { name: 'Priya Patel', phone: '(817) 555-1004', vehicle: '🚛 Truck', zone: 'Metro Wide' },
  ],

  automations: {
    'SMS on Pickup': true,
    'SMS on Delivery': true,
    'Email Proof of Delivery': true,
    'Late Delivery Alert': true,
    'Daily Summary Email': false,
    'Auto-Reassign': false,
    'Live Tracking Link': true,
    'Delivery Rating': false,
  },

  integrationPrompt: '',

  appFeatures: {
    'Photo on Pickup': true,
    'Signature on Delivery': true,
    'Barcode Scan': true,
    'Temperature Check': false,
    'Custom Form': false,
    'Wait Timer': true,
    'Navigation': true,
    'One-Tap Call': true,
  },
  selectedProfiles: [
    '🏥 Medical — Full chain of custody',
    '⚖️ Legal — Signature required',
    '🍕 Food — Temperature + photo',
    '📦 General — Standard POD',
    '💊 Pharmacy — ID verification',
  ],

  useOverflow: false,
  joinNetwork: true,

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
}))
