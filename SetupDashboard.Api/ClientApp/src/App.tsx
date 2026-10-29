import { useEffect, type ComponentType } from 'react'
import { Button, Loader, Paper } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
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
      <div className="fixed inset-0 bg-page flex flex-col items-center justify-center gap-4">
        <Loader size="lg" />
        <p className="text-ink font-semibold text-lg">Opening your setup…</p>
      </div>
    )
  }
  if (fatal) {
    return (
      <div className="fixed inset-0 bg-page flex items-center justify-center p-6">
        <Paper p="lg" maw={448} ta="center">
          <p className="text-ink font-semibold">Setup Dashboard couldn't start</p>
          <p className="text-sm text-dimmed mt-2">{fatal}</p>
        </Paper>
      </div>
    )
  }

  const step = STEPS[currentStep] ?? STEPS[0]
  const Screen = SCREENS[step.key]

  return (
    <div className="min-h-screen bg-page">
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
                  ? <Button variant="default" leftSection={<ArrowLeft size={16} strokeWidth={1.5} />} onClick={() => setCurrentStep(currentStep - 1)}>{STEPS[currentStep - 1].short}</Button>
                  : <div />}
                {currentStep < STEPS.length - 1 &&
                  <Button rightSection={<ArrowRight size={16} strokeWidth={1.5} />} onClick={() => setCurrentStep(currentStep + 1)}>{STEPS[currentStep + 1].short}</Button>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
