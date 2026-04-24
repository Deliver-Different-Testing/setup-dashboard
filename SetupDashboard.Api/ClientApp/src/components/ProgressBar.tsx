import { useStore } from '../store'

const STEPS = [
  { icon: '🏢', short: 'Business' },
  { icon: '👥', short: 'Team' },
  { icon: '📋', short: 'Clients' },
  { icon: '💰', short: 'Rates' },
  { icon: '🚗', short: 'Couriers' },
  { icon: '⚡', short: 'Automations' },
  { icon: '🔌', short: 'Integrations' },
  { icon: '📱', short: 'Driver App' },
  { icon: '🤝', short: 'Partners' },
  { icon: '🏋️', short: 'Training' },
]

export function ProgressBar() {
  const { currentStep, completedSteps, setCurrentStep } = useStore()
  const pct = currentStep / (STEPS.length - 1) * 100

  return (
    <div className="px-8 pt-6 pb-2">
      <div className="relative flex items-center justify-between max-w-4xl mx-auto">
        <div className="progress-line" style={{ left: 24, right: 24 }} />
        <div className="progress-line-fill" style={{ left: 24, width: `calc(${pct}% - 48px)` }} />
        {STEPS.map((s, i) => {
          const isComplete = completedSteps.has(i)
          const isCurrent = i === currentStep
          return (
            <div key={i} className="relative z-10 flex flex-col items-center cursor-pointer group" onClick={() => setCurrentStep(i)}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                isComplete ? 'bg-cyan text-white shadow-lg shadow-cyan/30' :
                isCurrent ? 'bg-white border-[3px] border-cyan step-pulse' :
                'bg-white border-2 border-gray-300'
              }`}>
                {isComplete ? '✓' : s.icon}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${isCurrent ? 'text-cyan' : 'text-gray-400'} group-hover:text-navy transition`}>
                {s.short}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
