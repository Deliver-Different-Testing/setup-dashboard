import { useStore } from './store'
import { Header } from './components/Header'
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

const STEP_COMPONENTS = [
  Step0Business, Step1Team, Step2Clients, Step3Rates, Step4Couriers,
  Step5Automations, Step6Integrations, Step7AppConfig, Step8Partners,
]

function App() {
  const { currentStep, setCurrentStep, completeStep } = useStore()

  const goBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1) }
  const goNext = () => {
    completeStep(currentStep)
    if (currentStep < 8) setCurrentStep(currentStep + 1)
  }

  return (
    <div className="min-h-screen bg-lgrey font-inter">
      <Header />
      <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
        <ChatSidebar />
        <main className="flex-1 overflow-y-auto">
          <ProgressBar />
          <div className="px-8 pb-8 relative">
            {STEP_COMPONENTS.map((StepComponent, i) => (
              <div key={i} className={`step-content ${i === currentStep ? 'active' : ''}`}>
                <div className="pt-4">
                  <StepComponent />
                </div>
                <div className="max-w-3xl mx-auto flex justify-between mt-8 pb-4">
                  {i > 0 ? (
                    <button onClick={goBack} className="px-6 py-2.5 rounded-full border border-gray-300 text-sm font-semibold text-gray-500 hover:border-navy hover:text-navy transition">← Back</button>
                  ) : <div />}
                  {i < 8 ? (
                    <button onClick={goNext} className="px-6 py-2.5 rounded-full bg-cyan text-white text-sm font-semibold hover:bg-cyan-dark transition shadow-lg shadow-cyan/20">Next →</button>
                  ) : <div />}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
