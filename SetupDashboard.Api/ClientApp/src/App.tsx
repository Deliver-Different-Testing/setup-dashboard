import { useEffect, type ComponentType } from 'react'
import { STEPS, useStore } from './store'
import type { StepKey } from './lib/api'
import { Header } from './components/Header'
import { ResumeSession } from './components/ResumeSession'
import { ProgressBar } from './components/ProgressBar'
import { ChatSidebar } from './components/ChatSidebar'
import { BusinessStep } from './components/steps/BusinessStep'
import { TeamStep } from './components/steps/TeamStep'
import { ClientsStep } from './components/steps/ClientsStep'
import { RatesStep } from './components/steps/RatesStep'
import { SchedulesStep } from './components/steps/SchedulesStep'
import { CouriersStep } from './components/steps/CouriersStep'
import { PartnersStep } from './components/steps/PartnersStep'
import { AppConfigStep, AutomationsStep, IntegrationsStep } from './components/steps/ChecklistStep'
import { TrainingStep } from './components/steps/TrainingStep'

const SCREENS: Record<StepKey, ComponentType> = {
  business: BusinessStep,
  team: TeamStep,
  clients: ClientsStep,
  rates: RatesStep,
  schedules: SchedulesStep,
  couriers: CouriersStep,
  partners: PartnersStep,
  automations: AutomationsStep,
  integrations: IntegrationsStep,
  appconfig: AppConfigStep,
  training: TrainingStep,
}

function App() {
  const { init, isInitializing, fatal, session, currentStep, setCurrentStep } = useStore()

  useEffect(() => { init() }, [init])

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-lgrey flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan/30 border-t-cyan rounded-full animate-spin" />
        <p className="text-navy font-semibold text-lg">Opening your setup…</p>
      </div>
    )
  }
  if (fatal) {
    return (
      <div className="fixed inset-0 bg-lgrey flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-6 max-w-md text-center">
          <p className="text-navy font-semibold">Setup Dashboard couldn't start</p>
          <p className="text-sm text-gray-500 mt-2">{fatal}</p>
        </div>
      </div>
    )
  }

  const step = STEPS[currentStep] ?? STEPS[0]
  const Screen = SCREENS[step.key]

  return (
    <div className="min-h-screen bg-lgrey font-inter">
      <ResumeSession />
      <Header />
      <div className="flex" style={{ height: 'calc(100vh - 60px)' }}>
        <ChatSidebar />
        <main className="flex-1 overflow-y-auto">
          <ProgressBar />
          {session && (
            <div className="px-8 pb-10 pt-4">
              <Screen key={step.key} />
              <div className="max-w-5xl mx-auto flex justify-between mt-8">
                {currentStep > 0
                  ? <button onClick={() => setCurrentStep(currentStep - 1)} className="px-6 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-navy hover:text-navy transition">← {STEPS[currentStep - 1].short}</button>
                  : <div />}
                {currentStep < STEPS.length - 1 &&
                  <button onClick={() => setCurrentStep(currentStep + 1)} className="px-6 py-2.5 rounded-full bg-navy text-white text-sm font-semibold hover:opacity-90 transition">{STEPS[currentStep + 1].short} →</button>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
