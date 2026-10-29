import { STEPS, useStore } from '../store'

export function ProgressBar() {
  const session = useStore(s => s.session)
  const currentStep = useStore(s => s.currentStep)
  const setCurrentStep = useStore(s => s.setCurrentStep)
  if (!session) return null

  return (
    <div className="px-8 pt-6 pb-2">
      <div className="relative flex items-center justify-between max-w-5xl mx-auto">
        <div className="progress-line" style={{ left: 24, right: 24 }} />
        {STEPS.map((s, i) => {
          const st = session.steps[s.key]
          const status = st?.status ?? 'not_started'
          const waiting = st?.requests.some(r => !r.fulfilledAt)
          const isCurrent = i === currentStep
          const ring = status === 'done' ? 'bg-brand text-shell shadow-lg shadow-brand/30'
            : status === 'waiting_on_tenant' ? 'bg-warn-light border-2 border-warn'
            : status === 'in_progress' ? 'bg-surface border-2 border-brand/60'
            : 'bg-surface border-2 border-line'
          return (
            <button key={s.key} type="button" className="relative z-10 flex flex-col items-center group" onClick={() => setCurrentStep(i)}
              title={waiting ? 'Waiting on the tenant' : undefined}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base transition-all ${ring} ${isCurrent ? 'step-pulse ring-2 ring-brand ring-offset-2 ring-offset-page' : ''}`}>
                {status === 'done' ? '✓' : waiting ? '⏳' : s.icon}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${isCurrent ? 'text-brand-text' : 'text-dimmed'} group-hover:text-ink transition`}>{s.short}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
