import { create } from 'zustand'
import { Building2, CalendarClock, Contact, GraduationCap, Handshake, Plug, Settings, Tag, Truck, Users, Zap, type LucideIcon } from 'lucide-react'
import * as api from './lib/api'
import type { Me, PushSummary, Session, SessionSummary, StepKey } from './lib/api'
import { errorMessage } from './lib/helpers'

// The server session is the single source of truth. Step forms edit a local copy and
// save it with saveStep; "Send" pushes the saved rows to Settings / Routed Ops.
// Nothing about the tenant is chosen here - it comes from the Hub cookie on the server.

export const STEPS: { key: StepKey; icon: LucideIcon; short: string; title: string }[] = [
  { key: 'business', icon: Building2, short: 'Business', title: 'Business profile' },
  { key: 'team', icon: Users, short: 'Team', title: 'Team, roles and access' },
  { key: 'clients', icon: Contact, short: 'Customers', title: 'Customers and booking contacts' },
  { key: 'rates', icon: Tag, short: 'Rates', title: 'Rates and zones' },
  { key: 'schedules', icon: CalendarClock, short: 'Schedules', title: 'Schedules' },
  { key: 'couriers', icon: Truck, short: 'Couriers', title: 'Couriers and fleets' },
  { key: 'partners', icon: Handshake, short: 'Partners', title: 'Agents and network partners' },
  { key: 'automations', icon: Zap, short: 'Automations', title: 'Automations' },
  { key: 'integrations', icon: Plug, short: 'Integrations', title: 'Integrations' },
  { key: 'appconfig', icon: Settings, short: 'App setup', title: 'App setup' },
  { key: 'training', icon: GraduationCap, short: 'Training', title: 'Training' },
]

/** `status` is what Auto-Mate is doing while no text has arrived yet; `error` marks a failed answer. */
interface ChatMessage { from: 'bot' | 'user'; text: string; status?: string; error?: boolean }

interface State {
  me: Me | null
  session: Session | null
  sessions: SessionSummary[]
  currentStep: number
  isInitializing: boolean
  showResumePrompt: boolean
  busy: Partial<Record<StepKey, 'saving' | 'sending' | null>>
  errors: Partial<Record<StepKey, string | null>>
  lastPush: Partial<Record<StepKey, PushSummary | null>>
  fatal: string | null

  // Auto-Mate sidebar: scripted step intros; typed questions are answered by CSP
  chatHistory: ChatMessage[]
  shownChatSteps: Set<number>
  /** CSP's chat session, so follow-up questions keep their context. */
  autoMateSessionId: string | null
  addChatMessage: (m: ChatMessage) => void
  /** By index: a step intro can land after the answer that is still streaming. */
  patchChatMessage: (index: number, patch: (m: ChatMessage) => ChatMessage) => void
  setAutoMateSessionId: (id: string) => void
  markChatStepShown: (i: number) => void

  init: () => Promise<void>
  startNew: () => Promise<void>
  resume: (id: string) => Promise<void>
  reload: () => Promise<void>
  setCurrentStep: (i: number) => void
  saveStep: (step: StepKey, data: unknown) => Promise<boolean>
  sendStep: (step: StepKey) => Promise<PushSummary | null>
  addRequest: (step: StepKey, item: string, dueBy?: string) => Promise<void>
  fulfilRequest: (step: StepKey, requestId: string) => Promise<void>
  tick: (step: StepKey, itemId: string, done: boolean) => Promise<void>
  complete: (step: StepKey) => Promise<void>
  reopen: (step: StepKey) => Promise<void>
  retryRow: (step: StepKey, kind: string, key: string) => Promise<void>
  removeSession: (id: string) => Promise<void>
}

const LAST_SESSION_KEY = 'setup-dashboard-last-session'

function rememberSession(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_SESSION_KEY, id)
    else localStorage.removeItem(LAST_SESSION_KEY)
  } catch { /* private mode */ }
}
function lastSession(): string | null {
  try { return localStorage.getItem(LAST_SESSION_KEY) } catch { return null }
}

export const useStore = create<State>((set, get) => {
  const guard = async (step: StepKey, kind: 'saving' | 'sending', fn: () => Promise<void>) => {
    set(s => ({ busy: { ...s.busy, [step]: kind }, errors: { ...s.errors, [step]: null } }))
    try { await fn() }
    catch (e: unknown) { set(s => ({ errors: { ...s.errors, [step]: errorMessage(e) } })); throw e }
    finally { set(s => ({ busy: { ...s.busy, [step]: null } })) }
  }
  const withSession = () => {
    const s = get().session
    if (!s) throw new Error('No setup is open. Reload the page or choose a setup to continue.')
    return s
  }

  return {
    me: null,
    session: null,
    sessions: [],
    currentStep: 0,
    isInitializing: true,
    showResumePrompt: false,
    busy: {},
    errors: {},
    lastPush: {},
    fatal: null,

    chatHistory: [],
    shownChatSteps: new Set(),
    autoMateSessionId: null,
    addChatMessage: m => set(s => ({ chatHistory: [...s.chatHistory, m] })),
    patchChatMessage: (index, patch) => set(s => ({ chatHistory: s.chatHistory.map((m, i) => i === index ? patch(m) : m) })),
    setAutoMateSessionId: id => set({ autoMateSessionId: id }),
    markChatStepShown: i => set(s => ({ shownChatSteps: new Set(s.shownChatSteps).add(i) })),

    init: async () => {
      set({ isInitializing: true, fatal: null })
      try {
        const me = await api.validateLogin()
        const { sessions } = await api.listSessions('active')
        set({ me, sessions })
        const last = lastSession()
        if (last && sessions.some(x => x.id === last)) await get().resume(last)
        else if (sessions.length > 0) set({ showResumePrompt: true })
        else await get().startNew()
      } catch (e: unknown) {
        set({ fatal: e instanceof api.ApiError && e.status === 403 ? 'Setup - Deliver DFRNT isn\'t turned on for your account. Ask DFRNT to turn it on.' : errorMessage(e, 'Setup - Deliver DFRNT couldn\'t start. Reload the page, or contact DFRNT if it keeps happening.') })
      } finally {
        set({ isInitializing: false })
      }
    },

    startNew: async () => {
      const { session } = await api.createSession()
      rememberSession(session.id)
      set({ session, currentStep: 0, showResumePrompt: false })
    },

    resume: async id => {
      const { session } = await api.getSession(id)
      rememberSession(session.id)
      set({ session, currentStep: session.currentStep ?? 0, showResumePrompt: false })
    },

    reload: async () => {
      const s = get().session
      if (!s) return
      const { session } = await api.getSession(s.id)
      set({ session })
    },

    setCurrentStep: i => {
      set({ currentStep: i })
      const s = get().session
      if (s) api.setCurrentStep(s.id, i).catch(() => { /* position only */ })
    },

    saveStep: async (step, data) => {
      const s = withSession()
      try {
        await guard(step, 'saving', async () => {
          const { session } = await api.saveStepData(s.id, step, data)
          set({ session })
        })
        return true
      } catch { return false }
    },

    sendStep: async step => {
      const s = withSession()
      let summary: PushSummary | null = null
      try {
        await guard(step, 'sending', async () => {
          const res = await api.pushStep(s.id, step)
          summary = res.summary
          set(st => ({ session: res.session, lastPush: { ...st.lastPush, [step]: res.summary } }))
        })
      } catch { /* error shown on the step */ }
      return summary
    },

    addRequest: async (step, item, dueBy) => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.addRequest(s.id, step, item, dueBy)).session }))
    },
    fulfilRequest: async (step, requestId) => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.fulfilRequest(s.id, step, requestId)).session }))
    },
    tick: async (step, itemId, done) => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.tickChecklist(s.id, step, itemId, done)).session }))
    },
    complete: async step => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.completeStep(s.id, step)).session }))
    },
    reopen: async step => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.reopenStep(s.id, step)).session }))
    },
    retryRow: async (step, kind, key) => {
      const s = withSession()
      await guard(step, 'saving', async () => set({ session: (await api.retryRow(s.id, step, kind, key)).session }))
    },

    removeSession: async id => {
      await api.deleteSession(id)
      if (get().session?.id === id) { rememberSession(null); set({ session: null }) }
      const { sessions } = await api.listSessions('active')
      set({ sessions })
    },
  }
})

/** Open requests across all steps - the "waiting on the tenant" count. */
export function openRequestCount(session: Session | null) {
  if (!session) return 0
  return Object.values(session.steps).reduce((n, st) => n + st.requests.filter(r => !r.fulfilledAt).length, 0)
}

export function completionPercent(session: Session | null) {
  if (!session) return 0
  const done = Object.values(session.steps).filter(st => st.status === 'done').length
  return Math.round((done / STEPS.length) * 100)
}
