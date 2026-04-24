import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Header } from './components/Header'
import { ResumeSession } from './components/ResumeSession'
import { ProgressBar } from './components/ProgressBar'
import { ChatSidebar } from './components/ChatSidebar'
import { Step0Business } from './components/steps/Step0Business'
import { Step1Team } from './components/steps/Step1Team'
import { Step2Clients } from './components/steps/Step2Clients'
import { Step3Rates } from './components/steps/Step3Rates'
import { Step4Couriers } from './components/steps/Step4Couriers'
import { Step5Automations } from './components/steps/Step5Automations'
import { Step6Integrations } from './components/steps/Step6Integrations'
import { Step7AppConfig } from './components/steps/Step7AppConfig'
import { Step8Partners } from './components/steps/Step8Partners'
import { Step9Training } from './components/steps/Step9Training'
// HelpPanel removed — Auto-Mate IS the help system

const STEP_COMPONENTS = [
  Step0Business, Step1Team, Step2Clients, Step3Rates, Step4Couriers,
  Step5Automations, Step6Integrations, Step7AppConfig, Step8Partners, Step9Training,
]

function StepStatus({ step }: { step: number }) {
  const status = useStore(s => s.apiStatus[step])
  const error = useStore(s => s.apiErrors[step])
  if (status === 'saving') return <span className="inline-flex items-center text-xs text-cyan ml-2"><span className="animate-spin mr-1">⟳</span>saving</span>
  if (status === 'saved') return <span className="text-xs text-green-500 ml-2">✓</span>
  if (status === 'error') return <span className="text-xs text-red-400 ml-2" title={error}>✗</span>
  return null
}

function ErrorBanner({ step }: { step: number }) {
  const error = useStore(s => s.apiErrors[step])
  const clearApiError = useStore(s => s.clearApiError)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (error) { setVisible(true); const t = setTimeout(() => { setVisible(false); clearApiError(step) }, 5000); return () => clearTimeout(t) }
  }, [error, step, clearApiError])

  if (!visible || !error) return null
  return <div className="max-w-3xl mx-auto mb-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
}

function LoadingOverlay() {
  const isInitializing = useStore(s => s.isInitializing)
  if (!isInitializing) return null
  return (
    <div className="fixed inset-0 z-[300] bg-lgrey flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-cyan/30 border-t-cyan rounded-full animate-spin" />
      <p className="text-navy font-semibold text-lg">Setting up your workspace...</p>
      <p className="text-gray-400 text-sm">Validating credentials and loading tenant data</p>
    </div>
  )
}

function App() {
  const { currentStep, setCurrentStep, completeStep, initSession, saveStep, apiStatus, checkForSessions, stepValidationBlocked } = useStore()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const hasPersistedSession = useStore.getState().sessionId != null
    const userAlreadyChose = sessionStorage.getItem('setup-dashboard-prompted') === '1'

    if (hasPersistedSession && userAlreadyChose) {
      // Mid-session refresh — silently resume from sessionStorage
      initSession()
    } else {
      // Fresh visit or F5 before choosing — show prompt if backend has sessions
      checkForSessions().then(() => {
        if (!useStore.getState().showResumePrompt) {
          initSession()
        }
      })
    }
  }, [checkForSessions, initSession])

  const goBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1) }
  const goNext = async () => {
    if (currentStep <= 5) {
      setSaving(true)
      await saveStep(currentStep)
      setSaving(false)
    }
    completeStep(currentStep)
    if (currentStep < 9) setCurrentStep(currentStep + 1)
  }

  const isSaving = saving || apiStatus[currentStep] === 'saving'
  const isBlocked = stepValidationBlocked[currentStep] === true

  return (
    <div className="min-h-screen bg-lgrey font-inter">
      <LoadingOverlay />
      <ResumeSession />
      <Header />
      <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
        <ChatSidebar />
        <main className="flex-1 overflow-y-auto">
          <ProgressBar />
          <div className="px-8 pb-8 relative">
            {STEP_COMPONENTS.map((StepComponent, i) => (
              <div key={i} className={`step-content ${i === currentStep ? 'active' : ''}`}>
                <div className="pt-4">
                  <ErrorBanner step={i} />
                  <StepComponent />
                  <StepStatus step={i} />
                </div>
                <div className="max-w-3xl mx-auto flex justify-between mt-8 pb-4">
                  {i > 0 ? (
                    <button onClick={goBack} className="px-6 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-navy hover:text-navy transition">← Back</button>
                  ) : <div />}
                  {i < 9 ? (
                    <button onClick={goNext} disabled={isSaving || isBlocked} className="px-6 py-2.5 rounded-full bg-cyan text-white text-sm font-semibold hover:bg-cyan-dark transition shadow-lg shadow-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed">
                      {isSaving ? <><span className="animate-spin inline-block mr-1">⟳</span>Saving...</> : 'Next →'}
                    </button>
                  ) : <div />}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      {/* HelpPanel removed */}
    </div>
  )
}

export default App
