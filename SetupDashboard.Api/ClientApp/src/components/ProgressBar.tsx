import { Box, Container } from '@mantine/core'
import { STEPS, useStore } from '../store'
import classes from './ProgressBar.module.css'

export function ProgressBar() {
  const session = useStore(s => s.session)
  const currentStep = useStore(s => s.currentStep)
  const setCurrentStep = useStore(s => s.setCurrentStep)
  if (!session) return null

  return (
    <Box px={32} pt={24} pb={8}>
      <Container size="lg" p={0} className={classes.track} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={classes.line} />
        {STEPS.map((s, i) => {
          const st = session.steps[s.key]
          const status = st?.status ?? 'not_started'
          const waiting = st?.requests.some(r => !r.fulfilledAt)
          const isCurrent = i === currentStep
          const ring = status === 'done' ? classes.done
            : status === 'waiting_on_tenant' ? classes.waiting
            : status === 'in_progress' ? classes.active
            : classes.idle
          return (
            <button key={s.key} type="button" className={classes.step} onClick={() => setCurrentStep(i)}
              title={waiting ? 'Waiting on tenant' : undefined}>
              <div className={`${classes.circle} ${ring} ${isCurrent ? classes.current : ''}`}>
                {status === 'done' ? '✓' : waiting ? '⏳' : s.icon}
              </div>
              <span className={`${classes.label} ${isCurrent ? classes.labelCurrent : ''}`}>{s.short}</span>
            </button>
          )
        })}
      </Container>
    </Box>
  )
}
